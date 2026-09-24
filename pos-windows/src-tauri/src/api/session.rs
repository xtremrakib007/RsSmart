use crate::db::models::PosSession;
use crate::db::repository::Repository;
use tauri::AppHandle;
use uuid::Uuid;

#[tauri::command]
pub async fn open_session(
    app: AppHandle,
    opening_cash: f64,
    notes: Option<String>,
) -> Result<PosSession, String> {
    let repo = Repository::new(&app)?;

    // Previously hardcoded to "tenant-1"/"user-001"/"device-001" — now sourced
    // from the real logged-in session and this machine's persistent device ID.
    let auth = repo.get_auth_session().await?.ok_or("Please log in before opening a session")?;
    let device_id = repo.get_or_create_device_id().await?;

    if repo.get_open_session(&device_id).await?.is_some() {
        return Err("Session already open".to_string());
    }

    let session = PosSession {
        id: Uuid::new_v4().to_string(),
        tenant_id: auth.tenant_id,
        user_id: auth.user_id,
        device_id: device_id.clone(),
        opening_cash,
        closing_cash: None,
        expected_cash: None,
        cash_difference: None,
        total_sales: 0.0,
        total_refunds: 0.0,
        transaction_count: 0,
        opened_at: chrono::Utc::now().timestamp_millis(),
        closed_at: None,
        status: "OPEN".to_string(),
        notes,
        sync_status: "PENDING".to_string(),
    };

    repo.create_session(&session).await?;

    // Queue the open for sync — this was previously missing entirely, so a
    // session's opening cash/notes never reached the server, only its close.
    let queue_item = crate::db::models::OfflineQueueItem {
        id: 0,
        entity_type: "SESSION".to_string(),
        entity_id: session.id.clone(),
        action: "CREATE".to_string(),
        payload: serde_json::json!({
            "localSessionId": session.id,
            "deviceId": device_id,
            "openingCash": opening_cash,
        })
        .to_string(),
        priority: 1,
        retry_count: 0,
        max_retries: 5,
        status: "PENDING".to_string(),
        error_message: None,
        created_at: chrono::Utc::now().timestamp_millis(),
        last_attempt: None,
    };
    repo.enqueue(&queue_item).await?;

    Ok(session)
}

#[tauri::command]
pub async fn close_session(
    app: AppHandle,
    closing_cash: f64,
    notes: Option<String>,
) -> Result<(), String> {
    let repo = Repository::new(&app)?;
    let device_id = repo.get_or_create_device_id().await?;

    let session = repo
        .get_open_session(&device_id)
        .await?
        .ok_or("No open session")?;

    let expected = session.opening_cash + session.total_sales - session.total_refunds;
    let diff = closing_cash - expected;

    repo.close_session(&session.id, closing_cash, expected, diff, notes).await?;

    // Queue session close for sync
    let queue_item = crate::db::models::OfflineQueueItem {
        id: 0,
        entity_type: "SESSION".to_string(),
        entity_id: session.id.clone(),
        action: "UPDATE".to_string(),
        payload: serde_json::json!({
            "localSessionId": session.id,
            "closingCash": closing_cash,
            "expectedCash": expected,
            "cashDifference": diff,
            "closedAt": chrono::Utc::now().timestamp_millis(),
        })
        .to_string(),
        priority: 2,
        retry_count: 0,
        max_retries: 5,
        status: "PENDING".to_string(),
        error_message: None,
        created_at: chrono::Utc::now().timestamp_millis(),
        last_attempt: None,
    };
    repo.enqueue(&queue_item).await?;

    Ok(())
}

#[tauri::command]
pub async fn get_open_session(app: AppHandle) -> Result<Option<PosSession>, String> {
    let repo = Repository::new(&app)?;
    let device_id = repo.get_or_create_device_id().await?;
    repo.get_open_session(&device_id).await
}
