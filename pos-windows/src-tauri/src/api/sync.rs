use crate::db::models::OfflineQueueItem;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_pending_sync_count(app: AppHandle) -> Result<i64, String> {
    let repo = Repository::new(&app)?;
    repo.get_pending_count().await
}

#[tauri::command]
pub async fn trigger_sync(app: AppHandle) -> Result<(), String> {
    crate::sync::trigger_sync(&app).await
}

#[tauri::command]
pub async fn get_offline_queue(app: AppHandle) -> Result<Vec<OfflineQueueItem>, String> {
    let repo = Repository::new(&app)?;
    let mut pending = repo.get_pending_queue().await?;
    // Also include recent completed/failed for visibility
    let recent = get_recent_queue(&repo).await?;
    pending.extend(recent);
    Ok(pending)
}

async fn get_recent_queue(repo: &Repository) -> Result<Vec<OfflineQueueItem>, String> {
    // This would need a new query in repository; simplified here
    Ok(vec![])
}
