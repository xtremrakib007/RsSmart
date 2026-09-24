use crate::db::models::AuthSession;
use crate::db::models::AuthStatus;
use crate::db::repository::Repository;
use crate::sync::get_sync_base_url;
use serde::Deserialize;
use tauri::AppHandle;

#[derive(Deserialize)]
struct LoginResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    user: LoginUser,
}

#[derive(Deserialize)]
struct LoginUser {
    id: String,
    email: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
}

/// Authenticates against the real backend's POST /auth/login and stores the
/// resulting tokens locally. Every screen/command that used to hardcode
/// "tenant-1" / "user-001" / "device-001" now reads the real tenant/user from
/// this session instead (device ID stays separate — see get_or_create_device_id
/// — since it identifies the machine, not the logged-in person).
#[tauri::command]
pub async fn login(app: AppHandle, email: String, password: String, tenant_id: String) -> Result<AuthStatus, String> {
    let base_url = get_sync_base_url()?;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{}/auth/login", base_url))
        .json(&serde_json::json!({ "email": email, "password": password, "tenantId": tenant_id }))
        .send()
        .await
        .map_err(|e| format!("Could not reach server: {}", e))?;

    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 => "Invalid email, password, or tenant ID".to_string(),
            429 => "Too many login attempts — please wait a moment and try again".to_string(),
            status => format!("Login failed (HTTP {})", status),
        });
    }

    let body: LoginResponse = response.json().await.map_err(|e| e.to_string())?;

    let repo = Repository::new(&app)?;
    repo.save_auth_session(&AuthSession {
        tenant_id: body.user.tenant_id.clone(),
        user_id: body.user.id.clone(),
        email: body.user.email.clone(),
        access_token: body.access_token,
        refresh_token: body.refresh_token,
    })
    .await?;

    Ok(AuthStatus {
        tenant_id: body.user.tenant_id,
        user_id: body.user.id,
        email: body.user.email,
    })
}

#[tauri::command]
pub async fn logout(app: AppHandle) -> Result<(), String> {
    let repo = Repository::new(&app)?;
    repo.clear_auth_session().await
}

#[tauri::command]
pub async fn get_auth_status(app: AppHandle) -> Result<Option<AuthStatus>, String> {
    let repo = Repository::new(&app)?;
    Ok(repo.get_auth_session().await?.map(|s| AuthStatus {
        tenant_id: s.tenant_id,
        user_id: s.user_id,
        email: s.email,
    }))
}

/// Calls POST /auth/refresh and persists the new tokens. Used by the sync
/// loop when a request comes back 401 (access token expired).
pub async fn refresh_access_token(app: &AppHandle) -> Result<String, String> {
    let repo = Repository::new(app)?;
    let session = repo.get_auth_session().await?.ok_or("Not logged in")?;
    let base_url = get_sync_base_url()?;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{}/auth/refresh", base_url))
        .json(&serde_json::json!({ "refreshToken": session.refresh_token }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        // Refresh token is also invalid/expired — the user needs to log in again.
        repo.clear_auth_session().await?;
        return Err("Session expired — please log in again".to_string());
    }

    let body: LoginResponse = response.json().await.map_err(|e| e.to_string())?;
    repo.save_auth_session(&AuthSession {
        tenant_id: body.user.tenant_id,
        user_id: body.user.id,
        email: body.user.email,
        access_token: body.access_token.clone(),
        refresh_token: body.refresh_token,
    })
    .await?;

    Ok(body.access_token)
}
