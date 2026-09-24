use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Branding {
    pub display_name: String,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
}

/// Per-deployment branding. Each company's installed copy of this app can be
/// configured with its own display name (and optional logo/accent color) via
/// environment variables — set at deployment time, e.g. in the launcher's
/// .env / service config — instead of the app always showing "RsSmart-ERP".
///
/// Falls back to "RsSmart-ERP" so the app still has a sensible label for
/// deployments that haven't set a company name yet.
///
/// Note: this reads local config only. The backend also exposes
/// GET /tenants/me/branding for clients with an authenticated session (e.g. a
/// future web/mobile dashboard) to manage branding centrally instead of via
/// per-machine env vars; the desktop apps don't have a login/device-auth flow
/// yet to safely call that endpoint from here.
#[tauri::command]
pub fn get_branding() -> Branding {
    Branding {
        display_name: std::env::var("RSSMART_BRAND_NAME").unwrap_or_else(|_| "RsSmart-ERP".to_string()),
        logo_url: std::env::var("RSSMART_BRAND_LOGO_URL").ok(),
        primary_color: std::env::var("RSSMART_BRAND_COLOR").ok(),
    }
}
