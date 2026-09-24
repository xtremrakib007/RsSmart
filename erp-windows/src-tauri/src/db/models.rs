use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String, pub sku: String, pub barcode: Option<String>,
    pub name: String, pub description: Option<String>, pub category_id: Option<String>,
    pub category_name: Option<String>, pub unit_price: f64, pub cost_price: Option<f64>,
    pub tax_rate: f64, pub stock_quantity: f64, pub reorder_level: f64,
    pub unit_of_measure: String, pub is_active: bool, pub image_url: Option<String>,
    pub tenant_id: String, pub created_at: i64, pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryMovement {
    pub id: String, pub product_id: String, pub product_name: String,
    pub r#type: String, pub quantity: f64, pub unit_cost: f64,
    pub total_cost: f64, pub reference: Option<String>, pub notes: Option<String>,
    pub created_by: String, pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrder {
    pub id: String, pub po_number: String, pub supplier_id: String,
    pub supplier_name: String, pub status: String, pub subtotal: f64,
    pub tax_amount: f64, pub total_amount: f64,
    pub expected_delivery: Option<i64>, pub received_at: Option<i64>,
    pub items: Vec<PurchaseOrderItem>, pub created_by: String,
    pub created_at: i64, pub approved_by: Option<String>, pub approved_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderItem {
    pub id: String, pub po_id: String, pub product_id: String,
    pub product_name: String, pub quantity: f64, pub unit_price: f64,
    pub total_price: f64, pub received_quantity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartOfAccount {
    pub id: String, pub code: String, pub name: String,
    pub r#type: String, pub parent_id: Option<String>,
    pub balance: f64, pub is_active: bool, pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub id: String, pub entry_number: String, pub date: i64,
    pub reference: Option<String>, pub description: String,
    pub total_debit: f64, pub total_credit: f64, pub is_balanced: bool,
    pub status: String, pub lines: Vec<JournalLine>,
    pub created_by: String, pub created_at: i64, pub posted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLine {
    pub id: String, pub journal_id: String, pub account_id: String,
    pub account_name: String, pub account_code: String,
    pub debit: f64, pub credit: f64, pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String, pub email: String, pub full_name: String,
    pub role: String, pub is_active: bool,
    pub last_login: Option<i64>, pub created_at: i64, pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String, pub entity_type: String, pub entity_id: String,
    pub action: String, pub old_values: Option<String>, pub new_values: Option<String>,
    pub performed_by: String, pub performed_by_name: String,
    pub ip_address: Option<String>, pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalWorkflow {
    pub id: String, pub entity_type: String, pub entity_id: String,
    pub entity_name: String, pub requested_by: String, pub requested_by_name: String,
    pub requested_at: i64, pub status: String,
    pub approver_id: Option<String>, pub approver_name: Option<String>,
    pub approved_at: Option<i64>, pub comments: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncHealth {
    pub device_id: String, pub device_name: String,
    pub last_sync: Option<i64>, pub pending_count: i64,
    pub failed_count: i64, pub status: String, pub latency_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportFilter {
    pub date_from: Option<i64>, pub date_to: Option<i64>,
    pub entity_type: Option<String>, pub status: Option<String>, pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KpiData {
    pub revenue: f64, pub expenses: f64, pub profit: f64,
    pub sales_count: i64, pub low_stock_count: i64,
    pub pending_po_count: i64, pub pending_approval_count: i64,
}
