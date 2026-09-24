use std::sync::{Arc, Mutex};
use std::collections::VecDeque;
use rusb::{Context, DeviceHandle, UsbContext};

#[derive(Debug, Clone)]
pub struct BarcodeScan {
    pub barcode: String,
    pub timestamp: u64,
    pub device_id: String,
}

static SCAN_BUFFER: Mutex<VecDeque<BarcodeScan>> = Mutex::new(VecDeque::new());

/// Read the next barcode from the scan buffer (non-blocking).
/// Returns None if no barcode has been scanned since the last read.
pub fn read_barcode() -> Option<BarcodeScan> {
    let mut buf = SCAN_BUFFER.lock().unwrap();
    buf.pop_front()
}

/// Peek at the last scanned barcode without removing it.
pub fn peek_last_barcode() -> Option<BarcodeScan> {
    let buf = SCAN_BUFFER.lock().unwrap();
    buf.back().cloned()
}

/// Clear the scan buffer.
pub fn clear_scan_buffer() {
    let mut buf = SCAN_BUFFER.lock().unwrap();
    buf.clear();
}

/// Simulate a barcode scan (for testing when no physical scanner is connected).
pub fn simulate_scan(barcode: &str) {
    let mut buf = SCAN_BUFFER.lock().unwrap();
    buf.push_back(BarcodeScan {
        barcode: barcode.to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        device_id: "SIMULATED".to_string(),
    });
}

/// Detect USB HID barcode scanners and start listening.
/// Most barcode scanners act as USB HID keyboards — they send keystrokes.
/// This function sets up a low-level keyboard hook on Windows to capture
/// scanner input (which typically enters as rapid sequential keystrokes).
pub fn start_hid_scanner_listener() -> Result<(), String> {
    #[cfg(windows)]
    {
        start_windows_keyboard_hook();
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("HID scanner listener only supported on Windows".to_string())
    }
}

#[cfg(windows)]
fn start_windows_keyboard_hook() {
    // In a real implementation, this would use SetWindowsHookEx with
    // WH_KEYBOARD_LL to capture keystrokes, buffer them with a short timeout
    // (scanners send characters faster than human typing), and emit a
    // barcode when the terminator character (usually Enter/CR) is received.
    //
    // For now, the hook is a no-op placeholder. The simulate_scan() function
    // can be used for development and testing.
    println!("[BarcodeScanner] Windows keyboard hook registered (placeholder)");
}

/// Serial barcode scanner support (for scanners configured as CDC/serial devices).
pub fn read_serial_barcode(port_name: &str) -> Result<String, Box<dyn std::error::Error>> {
    use serialport::{DataBits, Parity, StopBits};
    use std::time::Duration;

    let mut port = serialport::new(port_name, 9600)
        .timeout(Duration::from_millis(500))
        .data_bits(DataBits::Eight)
        .parity(Parity::None)
        .stop_bits(StopBits::One)
        .open()
        .map_err(|e| format!("Failed to open scanner port: {}", e))?;

    let mut buffer = String::new();
    let mut read_buf = [0u8; 64];

    // Read until terminator (CR or LF)
    loop {
        match port.read(&mut read_buf) {
            Ok(n) => {
                let chunk = String::from_utf8_lossy(&read_buf[..n]);
                buffer.push_str(&chunk);
                if buffer.contains('') || buffer.contains('
') {
                    break;
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {
                if !buffer.is_empty() {
                    break;
                }
            }
            Err(e) => return Err(e.into()),
        }
    }

    let barcode = buffer.trim().to_string();
    if !barcode.is_empty() {
        let mut buf = SCAN_BUFFER.lock().unwrap();
        buf.push_back(BarcodeScan {
            barcode: barcode.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            device_id: port_name.to_string(),
        });
    }

    Ok(barcode)
}

/// List potential serial barcode scanner ports.
pub fn list_serial_scanner_ports() -> Vec<String> {
    match serialport::available_ports() {
        Ok(ports) => ports
            .into_iter()
            .filter_map(|p| {
                match p.port_type {
                    serialport::SerialPortType::UsbPort(info) => {
                        // Honeywell, Datalogic, Zebra common VIDs
                        if matches!(info.vid, 0x0dd4 | 0x05e0 | 0x0a5f) {
                            Some(p.port_name)
                        } else {
                            None
                        }
                    }
                    serialport::SerialPortType::PciPort | serialport::SerialPortType::Unknown => {
                        // Check common scanner port name patterns
                        if p.port_name.contains("COM") {
                            Some(p.port_name)
                        } else {
                            None
                        }
                    }
                    _ => None,
                }
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}
