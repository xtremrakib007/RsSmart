use super::models::*;
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_sql::{Sqlite, SqliteExt};

pub struct Repository {
    pub db: Sqlite,
}

impl Repository {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let db = app.sqlite("retail_erp.db").map_err(|e| e.to_string())?;
        Ok(Self { db })
    }

    pub async fn get_products(&self, tenant_id: &str) -> Result<Vec<Product>, String> {
        let rows = self.db.select(
            "SELECT * FROM products WHERE tenant_id = ?1 ORDER BY name",
            vec![tenant_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_product).collect())
    }

    pub async fn save_product(&self, p: &Product) -> Result<(), String> {
        self.db.execute(
            "INSERT OR REPLACE INTO products (id, sku, barcode, name, description, category_id, category_name, unit_price, cost_price, tax_rate, stock_quantity, reorder_level, unit_of_measure, is_active, image_url, tenant_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            vec![
                p.id.clone().into(), p.sku.clone().into(), p.barcode.clone().unwrap_or_default().into(),
                p.name.clone().into(), p.description.clone().unwrap_or_default().into(),
                p.category_id.clone().unwrap_or_default().into(), p.category_name.clone().unwrap_or_default().into(),
                p.unit_price.into(), p.cost_price.into(), p.tax_rate.into(),
                p.stock_quantity.into(), p.reorder_level.into(), p.unit_of_measure.clone().into(),
                (if p.is_active { 1i64 } else { 0i64 }).into(), p.image_url.clone().unwrap_or_default().into(),
                p.tenant_id.clone().into(), p.created_at.into(), p.updated_at.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_product(&self, id: &str) -> Result<(), String> {
        self.db.execute("DELETE FROM products WHERE id = ?1", vec![id.into()])
            .await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_movements(&self, product_id: Option<String>) -> Result<Vec<InventoryMovement>, String> {
        let (sql, params) = if let Some(pid) = product_id {
            ("SELECT * FROM inventory_movements WHERE product_id = ?1 ORDER BY created_at DESC", vec![pid.into()])
        } else {
            ("SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT 200", vec![])
        };
        let rows = self.db.select(sql, params).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_movement).collect())
    }

    pub async fn record_movement(&self, m: &InventoryMovement) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, unit_cost, total_cost, reference, notes, created_by, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            vec![
                m.id.clone().into(), m.product_id.clone().into(), m.product_name.clone().into(),
                m.r#type.clone().into(), m.quantity.into(), m.unit_cost.into(), m.total_cost.into(),
                m.reference.clone().unwrap_or_default().into(), m.notes.clone().unwrap_or_default().into(),
                m.created_by.clone().into(), m.created_at.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        let qty = if m.r#type == "OUT" { -m.quantity } else { m.quantity };
        self.db.execute(
            "UPDATE products SET stock_quantity = stock_quantity + ?1, updated_at = ?2 WHERE id = ?3",
            vec![qty.into(), m.created_at.into(), m.product_id.clone().into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_purchase_orders(&self) -> Result<Vec<PurchaseOrder>, String> {
        let rows = self.db.select("SELECT * FROM purchase_orders ORDER BY created_at DESC", vec![])
            .await.map_err(|e| e.to_string())?;
        let mut orders = Vec::new();
        for row in rows {
            let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let items = self.get_po_items(&id).await?;
            orders.push(map_po(row, items));
        }
        Ok(orders)
    }

    pub async fn get_po_items(&self, po_id: &str) -> Result<Vec<PurchaseOrderItem>, String> {
        let rows = self.db.select(
            "SELECT * FROM purchase_order_items WHERE po_id = ?1",
            vec![po_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_po_item).collect())
    }

    pub async fn create_purchase_order(&self, po: &PurchaseOrder) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, status, subtotal, tax_amount, total_amount, expected_delivery, created_by, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            vec![
                po.id.clone().into(), po.po_number.clone().into(), po.supplier_id.clone().into(),
                po.supplier_name.clone().into(), po.status.clone().into(), po.subtotal.into(),
                po.tax_amount.into(), po.total_amount.into(), po.expected_delivery.into(),
                po.created_by.clone().into(), po.created_at.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        for item in &po.items {
            self.db.execute(
                "INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_price, total_price, received_quantity)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                vec![
                    item.id.clone().into(), item.po_id.clone().into(), item.product_id.clone().into(),
                    item.product_name.clone().into(), item.quantity.into(), item.unit_price.into(),
                    item.total_price.into(), item.received_quantity.into(),
                ],
            ).await.ok();
        }
        Ok(())
    }

    pub async fn update_po_status(&self, id: &str, status: &str) -> Result<(), String> {
        self.db.execute(
            "UPDATE purchase_orders SET status = ?1 WHERE id = ?2",
            vec![status.into(), id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_chart_of_accounts(&self) -> Result<Vec<ChartOfAccount>, String> {
        let rows = self.db.select("SELECT * FROM chart_of_accounts WHERE is_active = 1 ORDER BY code", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_account).collect())
    }

    pub async fn get_journal_entries(&self) -> Result<Vec<JournalEntry>, String> {
        let rows = self.db.select("SELECT * FROM journal_entries ORDER BY date DESC", vec![])
            .await.map_err(|e| e.to_string())?;
        let mut entries = Vec::new();
        for row in rows {
            let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let lines = self.get_journal_lines(&id).await?;
            entries.push(map_journal(row, lines));
        }
        Ok(entries)
    }

    pub async fn get_journal_lines(&self, journal_id: &str) -> Result<Vec<JournalLine>, String> {
        let rows = self.db.select(
            "SELECT * FROM journal_lines WHERE journal_id = ?1",
            vec![journal_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_journal_line).collect())
    }

    pub async fn create_journal_entry(&self, entry: &JournalEntry) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO journal_entries (id, entry_number, date, reference, description, total_debit, total_credit, is_balanced, status, created_by, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            vec![
                entry.id.clone().into(), entry.entry_number.clone().into(), entry.date.into(),
                entry.reference.clone().unwrap_or_default().into(), entry.description.clone().into(),
                entry.total_debit.into(), entry.total_credit.into(),
                (if entry.is_balanced { 1i64 } else { 0i64 }).into(),
                entry.status.clone().into(), entry.created_by.clone().into(), entry.created_at.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        for line in &entry.lines {
            self.db.execute(
                "INSERT INTO journal_lines (id, journal_id, account_id, account_name, account_code, debit, credit, description)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                vec![
                    line.id.clone().into(), line.journal_id.clone().into(), line.account_id.clone().into(),
                    line.account_name.clone().into(), line.account_code.clone().into(),
                    line.debit.into(), line.credit.into(), line.description.clone().unwrap_or_default().into(),
                ],
            ).await.ok();
        }
        Ok(())
    }

    pub async fn post_journal_entry(&self, id: &str) -> Result<(), String> {
        self.db.execute(
            "UPDATE journal_entries SET status = 'POSTED', posted_at = ?1 WHERE id = ?2",
            vec![(chrono::Utc::now().timestamp_millis() as i64).into(), id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_users(&self) -> Result<Vec<User>, String> {
        let rows = self.db.select("SELECT * FROM users ORDER BY created_at DESC", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_user).collect())
    }

    pub async fn save_user(&self, u: &User) -> Result<(), String> {
        self.db.execute(
            "INSERT OR REPLACE INTO users (id, email, full_name, role, is_active, last_login, created_at, permissions)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            vec![
                u.id.clone().into(), u.email.clone().into(), u.full_name.clone().into(),
                u.role.clone().into(), (if u.is_active { 1i64 } else { 0i64 }).into(),
                u.last_login.into(), u.created_at.into(), u.permissions.join(",").into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_user(&self, id: &str) -> Result<(), String> {
        self.db.execute("DELETE FROM users WHERE id = ?1", vec![id.into()])
            .await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_audit_logs(&self) -> Result<Vec<AuditLog>, String> {
        let rows = self.db.select("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_audit_log).collect())
    }

    pub async fn get_approvals(&self) -> Result<Vec<ApprovalWorkflow>, String> {
        let rows = self.db.select("SELECT * FROM approvals ORDER BY requested_at DESC", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_approval).collect())
    }

    pub async fn update_approval(&self, id: &str, status: &str, approver: &str, comments: Option<String>) -> Result<(), String> {
        self.db.execute(
            "UPDATE approvals SET status = ?1, approver_id = ?2, approver_name = ?2, approved_at = ?3, comments = ?4 WHERE id = ?5",
            vec![
                status.into(), approver.into(),
                (chrono::Utc::now().timestamp_millis() as i64).into(),
                comments.unwrap_or_default().into(), id.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_sync_health(&self) -> Result<Vec<SyncHealth>, String> {
        let rows = self.db.select("SELECT * FROM sync_health", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_sync_health).collect())
    }
}

fn map_product(row: serde_json::Map<String, Value>) -> Product {
    Product {
        id: get_str(&row, "id"), sku: get_str(&row, "sku"),
        barcode: opt_str(&row, "barcode"), name: get_str(&row, "name"),
        description: opt_str(&row, "description"), category_id: opt_str(&row, "category_id"),
        category_name: opt_str(&row, "category_name"), unit_price: get_f64(&row, "unit_price"),
        cost_price: row.get("cost_price").and_then(|v| v.as_f64()),
        tax_rate: get_f64(&row, "tax_rate"), stock_quantity: get_f64(&row, "stock_quantity"),
        reorder_level: get_f64(&row, "reorder_level"),
        unit_of_measure: get_str(&row, "unit_of_measure"), is_active: get_i64(&row, "is_active") == 1,
        image_url: opt_str(&row, "image_url"), tenant_id: get_str(&row, "tenant_id"),
        created_at: get_i64(&row, "created_at"), updated_at: get_i64(&row, "updated_at"),
    }
}

fn map_movement(row: serde_json::Map<String, Value>) -> InventoryMovement {
    InventoryMovement {
        id: get_str(&row, "id"), product_id: get_str(&row, "product_id"),
        product_name: get_str(&row, "product_name"), r#type: get_str(&row, "type"),
        quantity: get_f64(&row, "quantity"), unit_cost: get_f64(&row, "unit_cost"),
        total_cost: get_f64(&row, "total_cost"), reference: opt_str(&row, "reference"),
        notes: opt_str(&row, "notes"), created_by: get_str(&row, "created_by"),
        created_at: get_i64(&row, "created_at"),
    }
}

fn map_po(row: serde_json::Map<String, Value>, items: Vec<PurchaseOrderItem>) -> PurchaseOrder {
    PurchaseOrder {
        id: get_str(&row, "id"), po_number: get_str(&row, "po_number"),
        supplier_id: get_str(&row, "supplier_id"), supplier_name: get_str(&row, "supplier_name"),
        status: get_str(&row, "status"), subtotal: get_f64(&row, "subtotal"),
        tax_amount: get_f64(&row, "tax_amount"), total_amount: get_f64(&row, "total_amount"),
        expected_delivery: row.get("expected_delivery").and_then(|v| v.as_i64()),
        received_at: row.get("received_at").and_then(|v| v.as_i64()),
        items, created_by: get_str(&row, "created_by"), created_at: get_i64(&row, "created_at"),
        approved_by: opt_str(&row, "approved_by"), approved_at: row.get("approved_at").and_then(|v| v.as_i64()),
    }
}

fn map_po_item(row: serde_json::Map<String, Value>) -> PurchaseOrderItem {
    PurchaseOrderItem {
        id: get_str(&row, "id"), po_id: get_str(&row, "po_id"),
        product_id: get_str(&row, "product_id"), product_name: get_str(&row, "product_name"),
        quantity: get_f64(&row, "quantity"), unit_price: get_f64(&row, "unit_price"),
        total_price: get_f64(&row, "total_price"), received_quantity: get_f64(&row, "received_quantity"),
    }
}

fn map_account(row: serde_json::Map<String, Value>) -> ChartOfAccount {
    ChartOfAccount {
        id: get_str(&row, "id"), code: get_str(&row, "code"), name: get_str(&row, "name"),
        r#type: get_str(&row, "type"), parent_id: opt_str(&row, "parent_id"),
        balance: get_f64(&row, "balance"), is_active: get_i64(&row, "is_active") == 1,
        tenant_id: get_str(&row, "tenant_id"),
    }
}

fn map_journal(row: serde_json::Map<String, Value>, lines: Vec<JournalLine>) -> JournalEntry {
    JournalEntry {
        id: get_str(&row, "id"), entry_number: get_str(&row, "entry_number"),
        date: get_i64(&row, "date"), reference: opt_str(&row, "reference"),
        description: get_str(&row, "description"), total_debit: get_f64(&row, "total_debit"),
        total_credit: get_f64(&row, "total_credit"), is_balanced: get_i64(&row, "is_balanced") == 1,
        status: get_str(&row, "status"), lines, created_by: get_str(&row, "created_by"),
        created_at: get_i64(&row, "created_at"), posted_at: row.get("posted_at").and_then(|v| v.as_i64()),
    }
}

fn map_journal_line(row: serde_json::Map<String, Value>) -> JournalLine {
    JournalLine {
        id: get_str(&row, "id"), journal_id: get_str(&row, "journal_id"),
        account_id: get_str(&row, "account_id"), account_name: get_str(&row, "account_name"),
        account_code: get_str(&row, "account_code"), debit: get_f64(&row, "debit"),
        credit: get_f64(&row, "credit"), description: opt_str(&row, "description"),
    }
}

fn map_user(row: serde_json::Map<String, Value>) -> User {
    User {
        id: get_str(&row, "id"), email: get_str(&row, "email"),
        full_name: get_str(&row, "full_name"), role: get_str(&row, "role"),
        is_active: get_i64(&row, "is_active") == 1, last_login: row.get("last_login").and_then(|v| v.as_i64()),
        created_at: get_i64(&row, "created_at"),
        permissions: row.get("permissions").and_then(|v| v.as_str()).unwrap_or("").split(',').map(|s| s.to_string()).collect(),
    }
}

fn map_audit_log(row: serde_json::Map<String, Value>) -> AuditLog {
    AuditLog {
        id: get_str(&row, "id"), entity_type: get_str(&row, "entity_type"),
        entity_id: get_str(&row, "entity_id"), action: get_str(&row, "action"),
        old_values: opt_str(&row, "old_values"), new_values: opt_str(&row, "new_values"),
        performed_by: get_str(&row, "performed_by"), performed_by_name: get_str(&row, "performed_by_name"),
        ip_address: opt_str(&row, "ip_address"), timestamp: get_i64(&row, "timestamp"),
    }
}

fn map_approval(row: serde_json::Map<String, Value>) -> ApprovalWorkflow {
    ApprovalWorkflow {
        id: get_str(&row, "id"), entity_type: get_str(&row, "entity_type"),
        entity_id: get_str(&row, "entity_id"), entity_name: get_str(&row, "entity_name"),
        requested_by: get_str(&row, "requested_by"), requested_by_name: get_str(&row, "requested_by_name"),
        requested_at: get_i64(&row, "requested_at"), status: get_str(&row, "status"),
        approver_id: opt_str(&row, "approver_id"), approver_name: opt_str(&row, "approver_name"),
        approved_at: row.get("approved_at").and_then(|v| v.as_i64()), comments: opt_str(&row, "comments"),
    }
}

fn map_sync_health(row: serde_json::Map<String, Value>) -> SyncHealth {
    SyncHealth {
        device_id: get_str(&row, "device_id"), device_name: get_str(&row, "device_name"),
        last_sync: row.get("last_sync").and_then(|v| v.as_i64()), pending_count: get_i64(&row, "pending_count"),
        failed_count: get_i64(&row, "failed_count"), status: get_str(&row, "status"),
        latency_ms: get_i64(&row, "latency_ms"),
    }
}

fn get_str(row: &serde_json::Map<String, Value>, key: &str) -> String {
    row.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string()
}
fn opt_str(row: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    row.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
}
fn get_f64(row: &serde_json::Map<String, Value>, key: &str) -> f64 {
    row.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0)
}
fn get_i64(row: &serde_json::Map<String, Value>, key: &str) -> i64 {
    row.get(key).and_then(|v| v.as_i64()).unwrap_or(0)
}
