use crate::db::models::Product;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_products(app: AppHandle) -> Result<Vec<Product>, String> {
    let repo = Repository::new(&app)?;
    let auth = repo.get_auth_session().await?.ok_or("Please log in first")?;
    repo.get_products(&auth.tenant_id).await
}

#[tauri::command]
pub async fn search_products(app: AppHandle, query: String) -> Result<Vec<Product>, String> {
    let repo = Repository::new(&app)?;
    let auth = repo.get_auth_session().await?.ok_or("Please log in first")?;
    repo.search_products(&auth.tenant_id, &query).await
}

#[tauri::command]
pub async fn get_product_by_barcode(app: AppHandle, barcode: String) -> Result<Option<Product>, String> {
    let repo = Repository::new(&app)?;
    repo.get_product_by_barcode(&barcode).await
}
