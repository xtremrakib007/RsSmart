use crate::db::models::{Product, InventoryMovement};
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_products(app: AppHandle) -> Result<Vec<Product>, String> {
    Repository::new(&app)?.get_products("tenant-1").await
}

#[tauri::command]
pub async fn get_product(app: AppHandle, id: String) -> Result<Option<Product>, String> {
    let products = Repository::new(&app)?.get_products("tenant-1").await?;
    Ok(products.into_iter().find(|p| p.id == id))
}

#[tauri::command]
pub async fn save_product(app: AppHandle, product: Product) -> Result<(), String> {
    Repository::new(&app)?.save_product(&product).await
}

#[tauri::command]
pub async fn delete_product(app: AppHandle, id: String) -> Result<(), String> {
    Repository::new(&app)?.delete_product(&id).await
}

#[tauri::command]
pub async fn get_inventory_movements(app: AppHandle, product_id: Option<String>) -> Result<Vec<InventoryMovement>, String> {
    Repository::new(&app)?.get_movements(product_id).await
}

#[tauri::command]
pub async fn record_movement(app: AppHandle, movement: InventoryMovement) -> Result<(), String> {
    Repository::new(&app)?.record_movement(&movement).await
}
