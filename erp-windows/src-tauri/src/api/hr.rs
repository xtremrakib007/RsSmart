use crate::db::models::User;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_users(app: AppHandle) -> Result<Vec<User>, String> {
    Repository::new(&app)?.get_users().await
}

#[tauri::command]
pub async fn save_user(app: AppHandle, user: User) -> Result<(), String> {
    Repository::new(&app)?.save_user(&user).await
}

#[tauri::command]
pub async fn delete_user(app: AppHandle, id: String) -> Result<(), String> {
    Repository::new(&app)?.delete_user(&id).await
}
