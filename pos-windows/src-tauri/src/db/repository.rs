use super::models::*;
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_sql::{Sqlite, SqliteExt};

pub struct Repository {
    db: Sqlite,
}

impl Repository {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let db = app.sqlite("retail_pos.db").map_err(|e| e.to_string())?;
        Ok(Self { db })
    }

    // Session operations
    pub async fn get_open_session(&self, device_id: &str) -> Result<Option<PosSession>, String> {
        let rows = self.db.select(
            "SELECT * FROM pos_sessions WHERE status = 'OPEN' AND device_id = ?1 ORDER BY opened_at DESC LIMIT 1",
            vec![device_id.into()],
        ).await.map_err(|e| e.to_string())?;

        Ok(rows.into_iter().next().map(|r| map_session(r)))
    }

    pub async fn create_session(&self, session: &PosSession) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO pos_sessions (id, tenant_id, user_id, device_id, opening_cash, opened_at, status, notes, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            vec![
                session.id.clone().into(),
                session.tenant_id.clone().into(),
                session.user_id.clone().into(),
                session.device_id.clone().into(),
                session.opening_cash.into(),
                session.opened_at.into(),
                session.status.clone().into(),
                session.notes.clone().unwrap_or_default().into(),
                session.sync_status.clone().into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn close_session(&self, id: &str, closing_cash: f64, expected: f64, diff: f64, notes: Option<String>) -> Result<(), String> {
        self.db.execute(
            "UPDATE pos_sessions SET closing_cash = ?1, expected_cash = ?2, cash_difference = ?3, closed_at = ?4, status = 'CLOSED', notes = ?5, sync_status = 'PENDING'
             WHERE id = ?6",
            vec![
                closing_cash.into(),
                expected.into(),
                diff.into(),
                (chrono::Utc::now().timestamp_millis() as i64).into(),
                notes.unwrap_or_default().into(),
                id.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    // Product operations
    pub async fn get_products(&self, tenant_id: &str) -> Result<Vec<Product>, String> {
        let rows = self.db.select(
            "SELECT * FROM products WHERE is_active = 1 AND tenant_id = ?1 ORDER BY name ASC",
            vec![tenant_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_product).collect())
    }

    pub async fn search_products(&self, tenant_id: &str, query: &str) -> Result<Vec<Product>, String> {
        let like = format!("%{}%", query);
        let rows = self.db.select(
            "SELECT * FROM products WHERE is_active = 1 AND tenant_id = ?1 AND (name LIKE ?2 OR sku LIKE ?2 OR barcode LIKE ?2) ORDER BY name ASC",
            vec![tenant_id.into(), like.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_product).collect())
    }

    pub async fn get_product_by_barcode(&self, barcode: &str) -> Result<Option<Product>, String> {
        let rows = self.db.select(
            "SELECT * FROM products WHERE barcode = ?1 LIMIT 1",
            vec![barcode.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().map(map_product))
    }

    // Order operations
    pub async fn create_order(&self, order: &PosOrder) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO pos_orders (id, session_id, receipt_number, subtotal, total_discount, total_tax, grand_total, customer_id, customer_name, item_count, status, is_offline, created_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            vec![
                order.id.clone().into(),
                order.session_id.clone().into(),
                order.receipt_number.clone().into(),
                order.subtotal.into(),
                order.total_discount.into(),
                order.total_tax.into(),
                order.grand_total.into(),
                order.customer_id.clone().unwrap_or_default().into(),
                order.customer_name.clone().unwrap_or_default().into(),
                order.item_count.into(),
                order.status.clone().into(),
                if order.is_offline { 1i64 } else { 0i64 }.into(),
                order.created_at.into(),
                order.sync_status.clone().into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_orders_by_session(&self, session_id: &str) -> Result<Vec<PosOrder>, String> {
        let rows = self.db.select(
            "SELECT * FROM pos_orders WHERE session_id = ?1 ORDER BY created_at DESC",
            vec![session_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_order).collect())
    }

    pub async fn get_order_by_receipt(&self, receipt: &str) -> Result<Option<PosOrder>, String> {
        let rows = self.db.select(
            "SELECT * FROM pos_orders WHERE receipt_number = ?1 LIMIT 1",
            vec![receipt.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().map(map_order))
    }

    pub async fn mark_order_refunded(&self, id: &str) -> Result<(), String> {
        self.db.execute(
            "UPDATE pos_orders SET status = 'REFUNDED', sync_status = 'PENDING' WHERE id = ?1",
            vec![id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn mark_order_synced(&self, id: &str) -> Result<(), String> {
        self.db.execute(
            "UPDATE pos_orders SET sync_status = 'SYNCED' WHERE id = ?1",
            vec![id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_order_by_id(&self, id: &str) -> Result<Option<PosOrder>, String> {
        let rows = self.db.select(
            "SELECT * FROM pos_orders WHERE id = ?1 LIMIT 1",
            vec![id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().map(map_order))
    }

    // Payment operations
    pub async fn record_payment(&self, payment: &Payment) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO payments (id, order_id, session_id, amount, method, card_last_four, card_type, mobile_provider, mobile_reference, is_refund, processed_at, sync_status, receipt_number)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            vec![
                payment.id.clone().into(),
                payment.order_id.clone().into(),
                payment.session_id.clone().into(),
                payment.amount.into(),
                payment.method.clone().into(),
                payment.card_last_four.clone().unwrap_or_default().into(),
                payment.card_type.clone().unwrap_or_default().into(),
                payment.mobile_provider.clone().unwrap_or_default().into(),
                payment.mobile_reference.clone().unwrap_or_default().into(),
                if payment.is_refund { 1i64 } else { 0i64 }.into(),
                payment.processed_at.into(),
                payment.sync_status.clone().into(),
                payment.receipt_number.clone().unwrap_or_default().into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    // The original (non-refund) tender method for an order — used so refunds
    // match how the customer actually paid instead of assuming CASH.
    pub async fn get_original_payment_method(&self, order_id: &str) -> Result<Option<String>, String> {
        let rows = self.db.select(
            "SELECT method FROM payments WHERE order_id = ?1 AND is_refund = 0 ORDER BY processed_at DESC LIMIT 1",
            vec![order_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().and_then(|r| r.get("method").and_then(|v| v.as_str()).map(|s| s.to_string())))
    }

    pub async fn get_non_refund_payments(&self, order_id: &str) -> Result<Vec<Payment>, String> {
        let rows = self.db.select(
            "SELECT * FROM payments WHERE order_id = ?1 AND is_refund = 0",
            vec![order_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_payment).collect())
    }

    // Offline queue operations
    pub async fn enqueue(&self, item: &OfflineQueueItem) -> Result<i64, String> {
        self.db.execute(
            "INSERT INTO offline_queue (entity_type, entity_id, action, payload, priority, retry_count, max_retries, status, error_message, created_at, last_attempt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            vec![
                item.entity_type.clone().into(),
                item.entity_id.clone().into(),
                item.action.clone().into(),
                item.payload.clone().into(),
                item.priority.into(),
                item.retry_count.into(),
                item.max_retries.into(),
                item.status.clone().into(),
                item.error_message.clone().unwrap_or_default().into(),
                item.created_at.into(),
                item.last_attempt.map(|v| v.into()).unwrap_or(Value::Null),
            ],
        ).await.map_err(|e| e.to_string())?;

        let rows = self.db.select("SELECT last_insert_rowid() as id", vec![]).await.map_err(|e| e.to_string())?;
        let id = rows.first().and_then(|r| r.get("id")).and_then(|v| v.as_i64()).unwrap_or(0);
        Ok(id)
    }

    pub async fn get_pending_queue(&self) -> Result<Vec<OfflineQueueItem>, String> {
        let rows = self.db.select(
            "SELECT * FROM offline_queue WHERE status = 'PENDING' ORDER BY priority ASC, created_at ASC LIMIT 50",
            vec![],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_queue_item).collect())
    }

    pub async fn get_pending_count(&self) -> Result<i64, String> {
        let rows = self.db.select(
            "SELECT COUNT(*) as count FROM offline_queue WHERE status = 'PENDING'",
            vec![],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.first().and_then(|r| r.get("count")).and_then(|v| v.as_i64()).unwrap_or(0))
    }

    pub async fn update_queue_status(&self, id: i64, status: &str, retry_count: i32, error: Option<String>) -> Result<(), String> {
        self.db.execute(
            "UPDATE offline_queue SET status = ?1, retry_count = ?2, error_message = ?3, last_attempt = ?4 WHERE id = ?5",
            vec![
                status.into(),
                retry_count.into(),
                error.unwrap_or_default().into(),
                (chrono::Utc::now().timestamp_millis() as i64).into(),
                id.into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn prune_queue(&self) -> Result<(), String> {
        self.db.execute(
            "DELETE FROM offline_queue WHERE status = 'COMPLETED' OR (status = 'FAILED' AND retry_count >= max_retries)",
            vec![],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    // Session sales update
    pub async fn increment_session_sales(&self, session_id: &str, amount: f64) -> Result<(), String> {
        self.db.execute(
            "UPDATE pos_sessions SET total_sales = total_sales + ?1, transaction_count = transaction_count + 1 WHERE id = ?2",
            vec![amount.into(), session_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn increment_session_refunds(&self, session_id: &str, amount: f64) -> Result<(), String> {
        self.db.execute(
            "UPDATE pos_sessions SET total_refunds = total_refunds + ?1 WHERE id = ?2",
            vec![amount.into(), session_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn set_session_server_id(&self, local_id: &str, server_id: &str) -> Result<(), String> {
        self.db.execute(
            "UPDATE pos_sessions SET server_id = ?1 WHERE id = ?2",
            vec![server_id.into(), local_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_session_by_id(&self, id: &str) -> Result<Option<PosSession>, String> {
        let rows = self.db.select(
            "SELECT * FROM pos_sessions WHERE id = ?1 LIMIT 1",
            vec![id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().map(map_session))
    }

    pub async fn get_session_server_id(&self, local_id: &str) -> Result<Option<String>, String> {
        let rows = self.db.select(
            "SELECT server_id FROM pos_sessions WHERE id = ?1 LIMIT 1",
            vec![local_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().and_then(|r| r.get("server_id").and_then(|v| v.as_str()).map(|s| s.to_string())))
    }

    // Order items
    pub async fn save_order_items(&self, order_id: &str, items: &[OrderItem]) -> Result<(), String> {
        for item in items {
            self.db.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_amount, line_total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                vec![
                    order_id.into(),
                    item.product_id.clone().into(),
                    item.quantity.into(),
                    item.unit_price.into(),
                    item.discount_amount.into(),
                    item.tax_amount.into(),
                    item.line_total.into(),
                ],
            ).await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn get_order_items(&self, order_id: &str) -> Result<Vec<OrderItem>, String> {
        let rows = self.db.select(
            "SELECT * FROM order_items WHERE order_id = ?1",
            vec![order_id.into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(map_order_item).collect())
    }

    // Auth session
    pub async fn save_auth_session(&self, session: &AuthSession) -> Result<(), String> {
        self.db.execute(
            "INSERT INTO auth_session (id, tenant_id, user_id, email, access_token, refresh_token)
             VALUES (1, ?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                tenant_id = excluded.tenant_id,
                user_id = excluded.user_id,
                email = excluded.email,
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token",
            vec![
                session.tenant_id.clone().into(),
                session.user_id.clone().into(),
                session.email.clone().into(),
                session.access_token.clone().into(),
                session.refresh_token.clone().into(),
            ],
        ).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_auth_session(&self) -> Result<Option<AuthSession>, String> {
        let rows = self.db.select("SELECT * FROM auth_session WHERE id = 1", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().map(|row| AuthSession {
            tenant_id: get_str(&row, "tenant_id"),
            user_id: get_str(&row, "user_id"),
            email: get_str(&row, "email"),
            access_token: get_str(&row, "access_token"),
            refresh_token: get_str(&row, "refresh_token"),
        }))
    }

    pub async fn clear_auth_session(&self) -> Result<(), String> {
        self.db.execute("DELETE FROM auth_session WHERE id = 1", vec![])
            .await.map_err(|e| e.to_string())?;
        Ok(())
    }

    // Persistent per-machine device ID (see db/mod.rs for rationale).
    pub async fn get_or_create_device_id(&self) -> Result<String, String> {
        let rows = self.db.select(
            "SELECT value FROM app_config WHERE key = 'device_id'",
            vec![],
        ).await.map_err(|e| e.to_string())?;

        if let Some(row) = rows.into_iter().next() {
            return Ok(row.get("value").and_then(|v| v.as_str()).unwrap_or_default().to_string());
        }

        let device_id = format!("windows-{}", uuid::Uuid::new_v4());
        self.db.execute(
            "INSERT INTO app_config (key, value) VALUES ('device_id', ?1)",
            vec![device_id.clone().into()],
        ).await.map_err(|e| e.to_string())?;
        Ok(device_id)
    }
}

// Mappers
fn map_product(row: serde_json::Map<String, Value>) -> Product {
    Product {
        id: get_str(&row, "id"),
        sku: get_str(&row, "sku"),
        barcode: row.get("barcode").and_then(|v| v.as_str()).map(|s| s.to_string()),
        name: get_str(&row, "name"),
        description: row.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
        category_id: row.get("category_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        unit_price: get_f64(&row, "unit_price"),
        cost_price: row.get("cost_price").and_then(|v| v.as_f64()),
        tax_rate: get_f64(&row, "tax_rate"),
        stock_quantity: get_f64(&row, "stock_quantity"),
        unit_of_measure: get_str(&row, "unit_of_measure"),
        is_active: get_i64(&row, "is_active") == 1,
        image_url: row.get("image_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
        tenant_id: get_str(&row, "tenant_id"),
        sync_status: get_str(&row, "sync_status"),
        last_modified: get_i64(&row, "last_modified"),
        server_version: get_i64(&row, "server_version"),
    }
}

fn map_session(row: serde_json::Map<String, Value>) -> PosSession {
    PosSession {
        id: get_str(&row, "id"),
        tenant_id: get_str(&row, "tenant_id"),
        user_id: get_str(&row, "user_id"),
        device_id: get_str(&row, "device_id"),
        opening_cash: get_f64(&row, "opening_cash"),
        closing_cash: row.get("closing_cash").and_then(|v| v.as_f64()),
        expected_cash: row.get("expected_cash").and_then(|v| v.as_f64()),
        cash_difference: row.get("cash_difference").and_then(|v| v.as_f64()),
        total_sales: get_f64(&row, "total_sales"),
        total_refunds: get_f64(&row, "total_refunds"),
        transaction_count: get_i64(&row, "transaction_count") as i32,
        opened_at: get_i64(&row, "opened_at"),
        closed_at: row.get("closed_at").and_then(|v| v.as_i64()),
        status: get_str(&row, "status"),
        notes: row.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()),
        sync_status: get_str(&row, "sync_status"),
    }
}

fn map_order(row: serde_json::Map<String, Value>) -> PosOrder {
    PosOrder {
        id: get_str(&row, "id"),
        session_id: get_str(&row, "session_id"),
        receipt_number: get_str(&row, "receipt_number"),
        subtotal: get_f64(&row, "subtotal"),
        total_discount: get_f64(&row, "total_discount"),
        total_tax: get_f64(&row, "total_tax"),
        grand_total: get_f64(&row, "grand_total"),
        customer_id: row.get("customer_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        customer_name: row.get("customer_name").and_then(|v| v.as_str()).map(|s| s.to_string()),
        item_count: get_i64(&row, "item_count") as i32,
        status: get_str(&row, "status"),
        is_offline: get_i64(&row, "is_offline") == 1,
        created_at: get_i64(&row, "created_at"),
        sync_status: get_str(&row, "sync_status"),
        server_version: get_i64(&row, "server_version"),
    }
}

fn map_queue_item(row: serde_json::Map<String, Value>) -> OfflineQueueItem {
    OfflineQueueItem {
        id: get_i64(&row, "id"),
        entity_type: get_str(&row, "entity_type"),
        entity_id: get_str(&row, "entity_id"),
        action: get_str(&row, "action"),
        payload: get_str(&row, "payload"),
        priority: get_i64(&row, "priority") as i32,
        retry_count: get_i64(&row, "retry_count") as i32,
        max_retries: get_i64(&row, "max_retries") as i32,
        status: get_str(&row, "status"),
        error_message: row.get("error_message").and_then(|v| v.as_str()).map(|s| s.to_string()),
        created_at: get_i64(&row, "created_at"),
        last_attempt: row.get("last_attempt").and_then(|v| v.as_i64()),
    }
}

fn map_payment(row: serde_json::Map<String, Value>) -> Payment {
    Payment {
        id: get_str(&row, "id"),
        order_id: get_str(&row, "order_id"),
        session_id: get_str(&row, "session_id"),
        amount: get_f64(&row, "amount"),
        method: get_str(&row, "method"),
        card_last_four: row.get("card_last_four").and_then(|v| v.as_str()).map(|s| s.to_string()),
        card_type: row.get("card_type").and_then(|v| v.as_str()).map(|s| s.to_string()),
        mobile_provider: row.get("mobile_provider").and_then(|v| v.as_str()).map(|s| s.to_string()),
        mobile_reference: row.get("mobile_reference").and_then(|v| v.as_str()).map(|s| s.to_string()),
        is_refund: get_i64(&row, "is_refund") == 1,
        processed_at: get_i64(&row, "processed_at"),
        sync_status: get_str(&row, "sync_status"),
        receipt_number: row.get("receipt_number").and_then(|v| v.as_str()).map(|s| s.to_string()),
    }
}

fn map_order_item(row: serde_json::Map<String, Value>) -> OrderItem {    OrderItem {
        id: get_i64(&row, "id"),
        order_id: get_str(&row, "order_id"),
        product_id: get_str(&row, "product_id"),
        quantity: get_f64(&row, "quantity"),
        unit_price: get_f64(&row, "unit_price"),
        discount_amount: get_f64(&row, "discount_amount"),
        tax_amount: get_f64(&row, "tax_amount"),
        line_total: get_f64(&row, "line_total"),
    }
}

fn get_str(row: &serde_json::Map<String, Value>, key: &str) -> String {
    row.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string()
}

fn get_f64(row: &serde_json::Map<String, Value>, key: &str) -> f64 {
    row.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0)
}

fn get_i64(row: &serde_json::Map<String, Value>, key: &str) -> i64 {
    row.get(key).and_then(|v| v.as_i64()).unwrap_or(0)
}
