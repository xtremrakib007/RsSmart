use crate::db::models::SyncHealth;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_sync_health(app: AppHandle) -> Result<Vec<SyncHealth>, String> {
    Repository::new(&app)?.get_sync_health().await
}

#[tauri::command]
pub async fn trigger_sync(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
