use crate::db::models::PurchaseOrder;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_purchase_orders(app: AppHandle) -> Result<Vec<PurchaseOrder>, String> {
    Repository::new(&app)?.get_purchase_orders().await
}

#[tauri::command]
pub async fn get_purchase_order(app: AppHandle, id: String) -> Result<Option<PurchaseOrder>, String> {
    let orders = Repository::new(&app)?.get_purchase_orders().await?;
    Ok(orders.into_iter().find(|o| o.id == id))
}

#[tauri::command]
pub async fn create_purchase_order(app: AppHandle, order: PurchaseOrder) -> Result<(), String> {
    Repository::new(&app)?.create_purchase_order(&order).await
}

#[tauri::command]
pub async fn update_po_status(app: AppHandle, id: String, status: String) -> Result<(), String> {
    Repository::new(&app)?.update_po_status(&id, &status).await
}
