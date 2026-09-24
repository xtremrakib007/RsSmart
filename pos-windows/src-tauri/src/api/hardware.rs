use crate::db::repository::Repository;
use crate::hardware::{printer, scale, usb_devices, barcode_scanner, printer_queue, config};
use tauri::AppHandle;
use serde::Serialize;

#[derive(Serialize)]
pub struct PrinterInfo {
    name: String,
    r#type: String,
}

#[derive(Serialize)]
pub struct DeviceInfo {
    name: String,
    r#type: String,
    vendor_id: u16,
    product_id: u16,
}

#[derive(Serialize)]
pub struct BarcodeScanResult {
    barcode: String,
    timestamp: u64,
    device_id: String,
}

#[tauri::command]
pub async fn print_receipt(app: AppHandle, order_id: String) -> Result<(), String> {
    let repo = Repository::new(&app)?;
    let order = repo
        .db
        .select("SELECT * FROM pos_orders WHERE id = ?1", vec![order_id.into()])
        .await
        .map_err(|e| e.to_string())?;

    if order.is_empty() {
        return Err("Order not found".to_string());
    }

    let receipt = format_receipt(&order[0]);

    // Try to print; if printer unavailable, queue for later
    match printer::print_esc_pos(&receipt) {
        Ok(_) => Ok(()),
        Err(e) => {
            println!("[Print] Failed to print immediately: {}. Queuing for retry.", e);
            printer_queue::queue_receipt(&order_id, &receipt, "receipt-printer");
            Ok(()) // Return OK so POS flow isn't blocked
        }
    }
}

#[tauri::command]
pub async fn open_cash_drawer() -> Result<(), String> {
    printer::kick_cash_drawer().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let printers = printer::list_available_printers();
    Ok(printers
        .into_iter()
        .map(|(name, ty)| PrinterInfo { name, r#type: ty })
        .collect())
}

#[tauri::command]
pub async fn get_connected_devices() -> Result<Vec<DeviceInfo>, String> {
    let devices = usb_devices::list_usb_devices();
    Ok(devices
        .into_iter()
        .map(|d| DeviceInfo {
            name: d.name,
            r#type: format!("{:?}", d.device_type),
            vendor_id: d.vendor_id,
            product_id: d.product_id,
        })
        .collect())
}

#[tauri::command]
pub async fn read_scale() -> Result<f64, String> {
    scale::read_weight().map_err(|e| e.to_string())
}

// ── Barcode Scanner ──────────────────────────────────────

#[tauri::command]
pub async fn read_barcode() -> Result<Option<BarcodeScanResult>, String> {
    Ok(barcode_scanner::read_barcode().map(|scan| BarcodeScanResult {
        barcode: scan.barcode,
        timestamp: scan.timestamp,
        device_id: scan.device_id,
    }))
}

#[tauri::command]
pub async fn simulate_barcode_scan(barcode: String) -> Result<(), String> {
    barcode_scanner::simulate_scan(&barcode);
    Ok(())
}

#[tauri::command]
pub async fn list_scanner_ports() -> Result<Vec<String>, String> {
    Ok(barcode_scanner::list_serial_scanner_ports())
}

#[tauri::command]
pub async fn clear_scan_buffer() -> Result<(), String> {
    barcode_scanner::clear_scan_buffer();
    Ok(())
}

// ── Print Queue ──────────────────────────────────────────

#[tauri::command]
pub async fn get_print_queue() -> Result<Vec<printer_queue::QueuedReceipt>, String> {
    Ok(printer_queue::get_queued_receipts())
}

#[tauri::command]
pub async fn process_print_queue() -> Result<(usize, usize), String> {
    Ok(printer_queue::process_print_queue())
}

#[tauri::command]
pub async fn check_printer_status(printer_name: String) -> Result<printer_queue::PrinterStatus, String> {
    Ok(printer_queue::check_printer_status(&printer_name))
}

#[tauri::command]
pub async fn poll_all_printers() -> Result<Vec<printer_queue::PrinterStatus>, String> {
    Ok(printer_queue::poll_all_printers())
}

// ── Hardware Config ────────────────────────────────────────

#[tauri::command]
pub async fn get_hardware_config() -> Result<config::HardwareConfig, String> {
    Ok(config::load_config())
}

#[tauri::command]
pub async fn save_hardware_config(cfg: config::HardwareConfig) -> Result<(), String> {
    config::save_config(&cfg);
    Ok(())
}

#[tauri::command]
pub async fn auto_detect_hardware() -> Result<config::HardwareConfig, String> {
    Ok(config::auto_detect_hardware())
}

fn format_receipt(order: &serde_json::Map<String, serde_json::Value>) -> String {
    let mut receipt = String::new();
    receipt.push_str("===== RsSmart Receipt =====

");

    if let Some(id) = order.get("id").and_then(|v| v.as_str()) {
        receipt.push_str(&format!("Order: {}
", id));
    }
    if let Some(total) = order.get("total_amount").and_then(|v| v.as_f64()) {
        receipt.push_str(&format!("Total: RM {:.2}
", total));
    }
    if let Some(method) = order.get("payment_method").and_then(|v| v.as_str()) {
        receipt.push_str(&format!("Payment: {}
", method));
    }

    receipt.push_str("
==========================
");
    receipt.push_str("Thank you for your business!
");
    receipt
}
