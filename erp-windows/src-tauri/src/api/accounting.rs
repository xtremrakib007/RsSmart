use crate::db::models::{ChartOfAccount, JournalEntry};
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_chart_of_accounts(app: AppHandle) -> Result<Vec<ChartOfAccount>, String> {
    Repository::new(&app)?.get_chart_of_accounts().await
}

#[tauri::command]
pub async fn get_journal_entries(app: AppHandle, filters: Option<crate::db::models::ReportFilter>) -> Result<Vec<JournalEntry>, String> {
    Repository::new(&app)?.get_journal_entries().await
}

#[tauri::command]
pub async fn create_journal_entry(app: AppHandle, entry: JournalEntry) -> Result<(), String> {
    Repository::new(&app)?.create_journal_entry(&entry).await
}

#[tauri::command]
pub async fn post_journal_entry(app: AppHandle, id: String) -> Result<(), String> {
    Repository::new(&app)?.post_journal_entry(&id).await
}
