use crate::api::auth::refresh_access_token;
use crate::db::repository::Repository;
use tauri::AppHandle;
use tokio::time::{interval, Duration};

static SYNC_INTERVAL_SECS: u64 = 300; // 5 minutes

pub fn start_sync_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(SYNC_INTERVAL_SECS));
        loop {
            ticker.tick().await;
            if let Err(e) = perform_sync(&app).await {
                log::warn!("Background sync failed: {}", e);
            }
        }
    });
}

pub async fn trigger_sync(app: &AppHandle) -> Result<(), String> {
    perform_sync(app).await
}

/// Reads the sync API base URL from the RSSMART_API_BASE_URL environment variable.
/// Previously this was hardcoded to a placeholder domain (api.retail.example.com),
/// so every sync attempt silently failed with a DNS error instead of surfacing that
/// the app was never actually configured to talk to a real backend.
pub fn get_sync_base_url() -> Result<String, String> {
    std::env::var("RSSMART_API_BASE_URL").map_err(|_| {
        "RSSMART_API_BASE_URL is not set — configure the backend URL before sync can run"
            .to_string()
    })
}

/// Sends `req` with a Bearer token attached. On 401 (expired access token) it
/// refreshes once via /auth/refresh and retries with the new token — the
/// previous implementation never sent an Authorization header at all, so
/// every push against a real (auth-protected) backend would have failed.
async fn send_authed(
    app: &AppHandle,
    client: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    body: &serde_json::Value,
) -> Result<reqwest::Response, String> {
    let repo = Repository::new(app)?;
    let session = repo.get_auth_session().await?.ok_or("Not logged in")?;

    let resp = client
        .request(method.clone(), url)
        .bearer_auth(&session.access_token)
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().as_u16() != 401 {
        return Ok(resp);
    }

    // Access token expired — refresh once and retry.
    let new_token = refresh_access_token(app).await?;
    client
        .request(method, url)
        .bearer_auth(&new_token)
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())
}

async fn perform_sync(app: &AppHandle) -> Result<(), String> {
    let repo = Repository::new(app)?;

    // No point even reading the queue if we're not logged in — every call
    // below needs a token.
    if repo.get_auth_session().await?.is_none() {
        return Err("Not logged in".to_string());
    }

    let pending = repo.get_pending_queue().await?;
    if pending.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::new();
    let base_url = get_sync_base_url()?;

    for item in pending {
        let result = match item.entity_type.as_str() {
            "SESSION" if item.action == "CREATE" => sync_session_open(app, &repo, &client, &base_url, &item).await,
            "SESSION" => sync_session_close(&repo, &client, &base_url, app, &item).await,
            "ORDER" => sync_order(app, &repo, &client, &base_url, &item).await,
            "PAYMENT" => sync_refund_payment(app, &repo, &client, &base_url, &item).await,
            _ => Err(format!("Unknown entity type: {}", item.entity_type)),
        };

        match result {
            Ok(SyncOutcome::Completed) => {
                repo.update_queue_status(item.id, "COMPLETED", item.retry_count, None).await?;
            }
            Ok(SyncOutcome::WaitingOnDependency(msg)) => {
                // Leave PENDING without burning a retry — e.g. an order can't
                // sync until its session's open event has synced and we know
                // the server's session ID.
                repo.update_queue_status(item.id, "PENDING", item.retry_count, Some(msg)).await?;
            }
            Err(e) => {
                let new_retry = item.retry_count + 1;
                if new_retry >= item.max_retries {
                    repo.update_queue_status(item.id, "FAILED", new_retry, Some(e)).await?;
                } else {
                    repo.update_queue_status(item.id, "PENDING", new_retry, Some(e)).await?;
                }
            }
        }
    }

    repo.prune_queue().await?;
    Ok(())
}

/// Maps this app's local payment method labels to the backend's accepted
/// enum (CASH, CARD, CHEQUE, BANK_TRANSFER, CREDIT, MOBILE_MONEY). Without
/// this, "MOBILE" (used locally) would be rejected by the backend outright.
fn to_backend_method(local_method: &str) -> String {
    match local_method {
        "MOBILE" => "MOBILE_MONEY".to_string(),
        other => other.to_string(),
    }
}

enum SyncOutcome {
    Completed,
    WaitingOnDependency(String),
}

async fn sync_session_open(
    app: &AppHandle,
    repo: &Repository,
    client: &reqwest::Client,
    base_url: &str,
    item: &crate::db::models::OfflineQueueItem,
) -> Result<SyncOutcome, String> {
    let payload: serde_json::Value = serde_json::from_str(&item.payload).map_err(|e| e.to_string())?;
    let local_session_id = payload["localSessionId"].as_str().ok_or("Missing localSessionId")?;

    let resp = send_authed(
        app,
        client,
        reqwest::Method::POST,
        &format!("{}/pos-sessions/open", base_url),
        &serde_json::json!({
            "deviceId": payload["deviceId"],
            "openingCash": payload["openingCash"],
        }),
    )
    .await?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let server_id = body["id"].as_str().ok_or("Server did not return a session id")?;
    repo.set_session_server_id(local_session_id, server_id).await?;

    Ok(SyncOutcome::Completed)
}

async fn sync_session_close(
    repo: &Repository,
    client: &reqwest::Client,
    base_url: &str,
    app: &AppHandle,
    item: &crate::db::models::OfflineQueueItem,
) -> Result<SyncOutcome, String> {
    let payload: serde_json::Value = serde_json::from_str(&item.payload).map_err(|e| e.to_string())?;
    let local_session_id = payload["localSessionId"].as_str().ok_or("Missing localSessionId")?;

    let server_id = match repo.get_session_server_id(local_session_id).await? {
        Some(id) => id,
        None => return Ok(SyncOutcome::WaitingOnDependency(
            "Waiting for this session's open event to sync first".to_string(),
        )),
    };

    let resp = send_authed(
        app,
        client,
        reqwest::Method::PUT,
        &format!("{}/pos-sessions/{}/close", base_url, server_id),
        &serde_json::json!({
            "closingCash": payload["closingCash"],
        }),
    )
    .await?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    Ok(SyncOutcome::Completed)
}

async fn sync_order(
    app: &AppHandle,
    repo: &Repository,
    client: &reqwest::Client,
    base_url: &str,
    item: &crate::db::models::OfflineQueueItem,
) -> Result<SyncOutcome, String> {
    let order = repo.get_order_by_id(&item.entity_id).await?.ok_or("Order not found locally")?;

    let server_session_id = match repo.get_session_server_id(&order.session_id).await? {
        Some(id) => id,
        None => return Ok(SyncOutcome::WaitingOnDependency(
            "Waiting for this order's session to sync first".to_string(),
        )),
    };

    let items = repo.get_order_items(&order.id).await?;
    if items.is_empty() {
        return Err("Order has no line items on file — cannot sync".to_string());
    }
    let payments = repo.get_non_refund_payments(&order.id).await?;

    let items_json: Vec<serde_json::Value> = items
        .iter()
        .map(|i| serde_json::json!({
            "productId": i.product_id,
            "quantity": i.quantity,
            "unitPrice": i.unit_price,
            "discount": i.discount_amount,
        }))
        .collect();
    let payments_json: Vec<serde_json::Value> = payments
        .iter()
        .map(|p| serde_json::json!({ "method": to_backend_method(&p.method), "amount": p.amount }))
        .collect();

    let resp = send_authed(
        app,
        client,
        reqwest::Method::POST,
        &format!("{}/pos-transactions/checkout", base_url),
        &serde_json::json!({
            "sessionId": server_session_id,
            "items": items_json,
            "payments": payments_json,
            "customerId": order.customer_id,
            "notes": order.customer_name,
            // Idempotency key — safe to retry this call after a dropped
            // connection without creating a duplicate order server-side.
            "clientTransactionId": order.id,
        }),
    )
    .await?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    repo.mark_order_synced(&order.id).await?;
    Ok(SyncOutcome::Completed)
}

async fn sync_refund_payment(
    app: &AppHandle,
    repo: &Repository,
    client: &reqwest::Client,
    base_url: &str,
    item: &crate::db::models::OfflineQueueItem,
) -> Result<SyncOutcome, String> {
    let payload: serde_json::Value = serde_json::from_str(&item.payload).map_err(|e| e.to_string())?;
    let order_id = payload["orderId"].as_str().ok_or("Missing orderId")?;
    let local_session_id = payload["localSessionId"].as_str().ok_or("Missing localSessionId")?;

    let server_session_id = match repo.get_session_server_id(local_session_id).await? {
        Some(id) => id,
        None => return Ok(SyncOutcome::WaitingOnDependency(
            "Waiting for this session to sync first".to_string(),
        )),
    };

    // The order itself must already exist server-side before it can be refunded.
    let order = repo.get_order_by_id(order_id).await?.ok_or("Order not found locally")?;
    if order.sync_status != "SYNCED" {
        return Ok(SyncOutcome::WaitingOnDependency(
            "Waiting for the original order to sync first".to_string(),
        ));
    }

    let resp = send_authed(
        app,
        client,
        reqwest::Method::POST,
        &format!("{}/pos-transactions/refund/{}", base_url, order_id),
        &serde_json::json!({
            "sessionId": server_session_id,
            "amount": payload["amount"],
            "method": to_backend_method(payload["method"].as_str().unwrap_or("CASH")),
            "reference": payload.get("reason"),
        }),
    )
    .await?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    Ok(SyncOutcome::Completed)
}
