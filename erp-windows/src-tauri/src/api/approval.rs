use crate::db::models::ApprovalWorkflow;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_approvals(app: AppHandle) -> Result<Vec<ApprovalWorkflow>, String> {
    Repository::new(&app)?.get_approvals().await
}

#[tauri::command]
pub async fn approve_request(app: AppHandle, id: String, comments: Option<String>) -> Result<(), String> {
    Repository::new(&app)?.update_approval(&id, "APPROVED", "admin", comments).await
}

#[tauri::command]
pub async fn reject_request(app: AppHandle, id: String, comments: Option<String>) -> Result<(), String> {
    Repository::new(&app)?.update_approval(&id, "REJECTED", "admin", comments).await
}
