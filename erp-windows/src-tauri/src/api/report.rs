use crate::db::models::ReportFilter;
use tauri::AppHandle;

#[tauri::command]
pub async fn generate_report(_app: AppHandle, r#type: String, filters: ReportFilter) -> Result<String, String> {
    Ok(format!("Report {} generated", r#type))
}

#[tauri::command]
pub async fn export_to_excel(app: AppHandle, r#type: String, filters: ReportFilter) -> Result<String, String> {
    let path = crate::export::generate_csv(&app, &r#type, &filters).await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn export_to_pdf(_app: AppHandle, r#type: String, _filters: ReportFilter) -> Result<String, String> {
    Ok(format!("/tmp/{}.pdf", r#type))
}
