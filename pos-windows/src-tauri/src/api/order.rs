use crate::db::models::{CartItem, OrderItem, PosOrder};
use crate::db::repository::Repository;
use tauri::AppHandle;
use uuid::Uuid;

#[tauri::command]
pub async fn create_order(
    app: AppHandle,
    session_id: String,
    items: Vec<CartItem>,
    customer_name: Option<String>,
) -> Result<PosOrder, String> {
    let repo = Repository::new(&app)?;

    if items.is_empty() {
        return Err("Cart is empty".to_string());
    }

    let subtotal: f64 = items.iter().map(|i| i.unit_price * i.quantity).sum();
    let total_tax: f64 = items.iter().map(|i| i.tax_amount).sum();
    let grand_total: f64 = items.iter().map(|i| i.line_total).sum();

    let order = PosOrder {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.clone(),
        receipt_number: format!("POS-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
        subtotal,
        total_discount: 0.0,
        total_tax,
        grand_total,
        customer_id: None,
        customer_name,
        item_count: items.len() as i32,
        status: "COMPLETED".to_string(),
        is_offline: false,
        created_at: chrono::Utc::now().timestamp_millis(),
        sync_status: "PENDING".to_string(),
        server_version: 0,
    };

    repo.create_order(&order).await?;
    repo.increment_session_sales(&session_id, grand_total).await?;

    // Persist line items so sync has enough detail to call the real backend's
    // checkout endpoint (productId/quantity/unitPrice/discount per line) —
    // previously only aggregate totals were stored, so this detail was lost.
    let order_items: Vec<OrderItem> = items
        .iter()
        .map(|i| OrderItem {
            id: 0,
            order_id: order.id.clone(),
            product_id: i.product_id.clone(),
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_amount: i.discount_amount,
            tax_amount: i.tax_amount,
            line_total: i.line_total,
        })
        .collect();
    repo.save_order_items(&order.id, &order_items).await?;

    // Queue for sync
    let queue_item = crate::db::models::OfflineQueueItem {
        id: 0,
        entity_type: "ORDER".to_string(),
        entity_id: order.id.clone(),
        action: "CREATE".to_string(),
        payload: serde_json::to_string(&order).unwrap_or_default(),
        priority: 3,
        retry_count: 0,
        max_retries: 5,
        status: "PENDING".to_string(),
        error_message: None,
        created_at: chrono::Utc::now().timestamp_millis(),
        last_attempt: None,
    };
    repo.enqueue(&queue_item).await?;

    Ok(order)
}

#[tauri::command]
pub async fn get_orders_by_session(app: AppHandle, session_id: String) -> Result<Vec<PosOrder>, String> {
    let repo = Repository::new(&app)?;
    repo.get_orders_by_session(&session_id).await
}
