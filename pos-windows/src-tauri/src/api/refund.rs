use crate::db::models::Payment;
use crate::db::repository::Repository;
use tauri::AppHandle;
use uuid::Uuid;

#[tauri::command]
pub async fn process_refund(
    app: AppHandle,
    receipt_number: String,
    amount: f64,
    reason: Option<String>,
) -> Result<(), String> {
    let repo = Repository::new(&app)?;

    let order = repo
        .get_order_by_receipt(&receipt_number)
        .await?
        .ok_or("Order not found")?;

    if order.status == "REFUNDED" {
        return Err("Order already refunded".to_string());
    }

    if amount > order.grand_total {
        return Err("Refund exceeds order total".to_string());
    }

    repo.mark_order_refunded(&order.id).await?;
    repo.increment_session_refunds(&order.session_id, amount).await?;

    // Match the refund's tender method to the original sale instead of
    // assuming cash — falls back to CASH only if no original payment is on file.
    let method = repo.get_original_payment_method(&order.id).await?.unwrap_or_else(|| "CASH".to_string());

    let refund_payment = Payment {
        id: Uuid::new_v4().to_string(),
        order_id: order.id.clone(),
        session_id: order.session_id.clone(),
        amount,
        method: method.clone(),
        card_last_four: None,
        card_type: None,
        mobile_provider: None,
        mobile_reference: None,
        is_refund: true,
        processed_at: chrono::Utc::now().timestamp_millis(),
        sync_status: "PENDING".to_string(),
        receipt_number: Some(order.receipt_number.clone()),
    };

    repo.record_payment(&refund_payment).await?;

    let queue_item = crate::db::models::OfflineQueueItem {
        id: 0,
        entity_type: "PAYMENT".to_string(),
        entity_id: refund_payment.id.clone(),
        action: "CREATE".to_string(),
        payload: serde_json::json!({
            "refund": true,
            "orderId": order.id,
            "localSessionId": order.session_id,
            "amount": amount,
            "method": method,
            "reason": reason,
        })
        .to_string(),
        priority: 2,
        retry_count: 0,
        max_retries: 5,
        status: "PENDING".to_string(),
        error_message: None,
        created_at: chrono::Utc::now().timestamp_millis(),
        last_attempt: None,
    };
    repo.enqueue(&queue_item).await?;

    Ok(())
}
