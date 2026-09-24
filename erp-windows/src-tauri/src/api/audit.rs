use crate::db::models::AuditLog;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_audit_logs(app: AppHandle, filters: Option<crate::db::models::ReportFilter>) -> Result<Vec<AuditLog>, String> {
    Repository::new(&app)?.get_audit_logs().await
}
