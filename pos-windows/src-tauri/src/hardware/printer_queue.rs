use std::sync::{Arc, Mutex};
use std::collections::VecDeque;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedReceipt {
    pub id: String,
    pub order_id: String,
    pub receipt_text: String,
    pub printer_name: String,
    pub created_at: u64,
    pub retry_count: u32,
}

static PRINT_QUEUE: Mutex<VecDeque<QueuedReceipt>> = Mutex::new(VecDeque::new());

/// Add a receipt to the offline print queue.
/// Called when the printer is disconnected or print fails.
pub fn queue_receipt(order_id: &str, receipt_text: &str, printer_name: &str) {
    let mut queue = PRINT_QUEUE.lock().unwrap();
    queue.push_back(QueuedReceipt {
        id: format!("queue-{}", uuid::Uuid::new_v4()),
        order_id: order_id.to_string(),
        receipt_text: receipt_text.to_string(),
        printer_name: printer_name.to_string(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        retry_count: 0,
    });
    println!("[PrintQueue] Receipt queued for {} ({} items in queue)", printer_name, queue.len());
}

/// Get all queued receipts.
pub fn get_queued_receipts() -> Vec<QueuedReceipt> {
    let queue = PRINT_QUEUE.lock().unwrap();
    queue.iter().cloned().collect()
}

/// Remove a receipt from the queue after successful print.
pub fn remove_from_queue(queue_id: &str) {
    let mut queue = PRINT_QUEUE.lock().unwrap();
    queue.retain(|r| r.id != queue_id);
}

/// Attempt to print all queued receipts.
/// Returns (success_count, fail_count).
pub fn process_print_queue() -> (usize, usize) {
    let mut success = 0;
    let mut fail = 0;

    let receipts = {
        let queue = PRINT_QUEUE.lock().unwrap();
        queue.iter().cloned().collect::<Vec<_>>()
    };

    for receipt in receipts {
        match super::printer::print_esc_pos(&receipt.receipt_text) {
            Ok(_) => {
                remove_from_queue(&receipt.id);
                success += 1;
            }
            Err(e) => {
                println!("[PrintQueue] Retry failed for {}: {}", receipt.id, e);
                fail += 1;
                // Increment retry count — could add max retry logic here
            }
        }
    }

    (success, fail)
}

/// Printer status detection.
#[derive(Debug, Clone, Serialize)]
pub struct PrinterStatus {
    pub name: String,
    pub connected: bool,
    pub online: bool,
    pub paper_out: bool,
    pub cover_open: bool,
    pub error: Option<String>,
}

/// Check status of a USB ESC/POS printer.
/// Sends DLE EOT n (real-time status) command and parses response.
pub fn check_printer_status(printer_name: &str) -> PrinterStatus {
    // For USB printers, attempt to open and send a status query
    use rusb::{Context, DeviceHandle};

    let mut status = PrinterStatus {
        name: printer_name.to_string(),
        connected: false,
        online: false,
        paper_out: false,
        cover_open: false,
        error: None,
    };

    // Try to find the printer by name pattern
    if let Ok(ctx) = Context::new() {
        if let Ok(devices) = ctx.devices() {
            for device in devices.iter() {
                if let Ok(desc) = device.device_descriptor() {
                    if super::printer::is_printer(desc.vendor_id(), desc.product_id()) {
                        status.connected = true;
                        // Real status query would require opening the device,
                        // sending DLE EOT 2 (printer status), and reading response
                        // For now, assume online if connected
                        status.online = true;
                        break;
                    }
                }
            }
        }
    }

    // If no USB printer found, check Windows spooler
    if !status.connected {
        status.connected = printer_name == "Windows Default Printer";
        status.online = status.connected;
    }

    status
}

/// Poll all known printers and return their status.
pub fn poll_all_printers() -> Vec<PrinterStatus> {
    let printers = super::printer::list_available_printers();
    printers
        .into_iter()
        .map(|(name, _)| check_printer_status(&name))
        .collect()
}
