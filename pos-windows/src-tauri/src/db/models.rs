use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub sku: String,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub unit_price: f64,
    pub cost_price: Option<f64>,
    pub tax_rate: f64,
    pub stock_quantity: f64,
    pub unit_of_measure: String,
    pub is_active: bool,
    pub image_url: Option<String>,
    pub tenant_id: String,
    pub sync_status: String,
    pub last_modified: i64,
    pub server_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItem {
    pub id: i64,
    pub session_id: String,
    pub product_id: String,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub line_total: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PosSession {
    pub id: String,
    pub tenant_id: String,
    pub user_id: String,
    pub device_id: String,
    pub opening_cash: f64,
    pub closing_cash: Option<f64>,
    pub expected_cash: Option<f64>,
    pub cash_difference: Option<f64>,
    pub total_sales: f64,
    pub total_refunds: f64,
    pub transaction_count: i32,
    pub opened_at: i64,
    pub closed_at: Option<i64>,
    pub status: String,
    pub notes: Option<String>,
    pub sync_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PosOrder {
    pub id: String,
    pub session_id: String,
    pub receipt_number: String,
    pub subtotal: f64,
    pub total_discount: f64,
    pub total_tax: f64,
    pub grand_total: f64,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub item_count: i32,
    pub status: String,
    pub is_offline: bool,
    pub created_at: i64,
    pub sync_status: String,
    pub server_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub order_id: String,
    pub session_id: String,
    pub amount: f64,
    pub method: String,
    pub card_last_four: Option<String>,
    pub card_type: Option<String>,
    pub mobile_provider: Option<String>,
    pub mobile_reference: Option<String>,
    pub is_refund: bool,
    pub processed_at: i64,
    pub sync_status: String,
    pub receipt_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineQueueItem {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub payload: String,
    pub priority: i32,
    pub retry_count: i32,
    pub max_retries: i32,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: i64,
    pub last_attempt: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitPayment {
    pub method: String,
    pub amount: f64,
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: i64,
    pub order_id: String,
    pub product_id: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub line_total: f64,
}

// Logged-in user/tenant for this device, plus tokens for calling the backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub tenant_id: String,
    pub user_id: String,
    pub email: String,
    pub access_token: String,
    pub refresh_token: String,
}

// Safe subset returned to the frontend — never the raw tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    pub tenant_id: String,
    pub user_id: String,
    pub email: String,
}
