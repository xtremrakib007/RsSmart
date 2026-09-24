use crate::db::models::Payment;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn record_payment(app: AppHandle, payment: Payment) -> Result<(), String> {
    let repo = Repository::new(&app)?;
    repo.record_payment(&payment).await?;

    // Non-refund payments are intentionally NOT queued separately — the real
    // backend's checkout endpoint (POST /pos-transactions/checkout) takes
    // payments as part of the same atomic call as the order, and the sync
    // loop builds that payments array itself from local payment rows when it
    // pushes the ORDER event. Queuing a second, independent "PAYMENT" sync
    // call here would just be redundant (refund payments still get their own
    // queue entry — see api/refund.rs, which calls /pos-transactions/refund).
    if payment.is_refund {
        let queue_item = crate::db::models::OfflineQueueItem {
            id: 0,
            entity_type: "PAYMENT".to_string(),
            entity_id: payment.id.clone(),
            action: "CREATE".to_string(),
            payload: serde_json::to_string(&payment).unwrap_or_default(),
            priority: 2,
            retry_count: 0,
            max_retries: 5,
            status: "PENDING".to_string(),
            error_message: None,
            created_at: chrono::Utc::now().timestamp_millis(),
            last_attempt: None,
        };
        repo.enqueue(&queue_item).await?;
    }

    Ok(())
}
