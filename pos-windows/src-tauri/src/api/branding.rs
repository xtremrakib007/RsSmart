use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Branding {
    pub display_name: String,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
}

/// Per-deployment branding — see erp-windows/src-tauri/src/api/branding.rs for
/// the full rationale. Each company's installed copy of this app can set its
/// own display name via RSSMART_BRAND_NAME instead of always showing
/// "RsSmart-POS".
#[tauri::command]
pub fn get_branding() -> Branding {
    Branding {
        display_name: std::env::var("RSSMART_BRAND_NAME").unwrap_or_else(|_| "RsSmart-POS".to_string()),
        logo_url: std::env::var("RSSMART_BRAND_LOGO_URL").ok(),
        primary_color: std::env::var("RSSMART_BRAND_COLOR").ok(),
    }
}
