use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareConfig {
    pub receipt_printer: PrinterConfig,
    pub kitchen_printer: Option<PrinterConfig>,
    pub label_printer: Option<PrinterConfig>,
    pub cash_drawer: CashDrawerConfig,
    pub barcode_scanner: BarcodeScannerConfig,
    pub scale: ScaleConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterConfig {
    pub name: String,
    pub printer_type: String, // "USB_ESC_POS", "WINDOWS_SPOOLER", "NETWORK"
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub ip_address: Option<String>,
    pub port: Option<u16>,
    pub paper_width: u8, // 58mm or 80mm
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashDrawerConfig {
    pub connected_to_printer: bool,
    pub kick_command: Vec<u8>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarcodeScannerConfig {
    pub mode: String, // "USB_HID", "SERIAL", "BLUETOOTH"
    pub serial_port: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleConfig {
    pub protocol: String, // "METTLER_TOLEDO", "AANDD", "GENERIC_RS232"
    pub serial_port: String,
    pub enabled: bool,
}

impl Default for HardwareConfig {
    fn default() -> Self {
        HardwareConfig {
            receipt_printer: PrinterConfig {
                name: "Default Receipt Printer".to_string(),
                printer_type: "USB_ESC_POS".to_string(),
                vendor_id: Some(0x04b8),
                product_id: Some(0x0e15),
                ip_address: None,
                port: None,
                paper_width: 80,
                enabled: true,
            },
            kitchen_printer: None,
            label_printer: None,
            cash_drawer: CashDrawerConfig {
                connected_to_printer: true,
                kick_command: vec![0x1B, 0x70, 0x00, 0x19, 0xFA],
                enabled: true,
            },
            barcode_scanner: BarcodeScannerConfig {
                mode: "USB_HID".to_string(),
                serial_port: None,
                enabled: true,
            },
            scale: ScaleConfig {
                protocol: "METTLER_TOLEDO".to_string(),
                serial_port: "COM3".to_string(),
                enabled: false,
            },
        }
    }
}

fn config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("rssmart");
    path.push("hardware-config.json");
    path
}

pub fn load_config() -> HardwareConfig {
    let path = config_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(config) => config,
                Err(e) => {
                    eprintln!("[HardwareConfig] Failed to parse config: {}, using default", e);
                    HardwareConfig::default()
                }
            },
            Err(e) => {
                eprintln!("[HardwareConfig] Failed to read config: {}, using default", e);
                HardwareConfig::default()
            }
        }
    } else {
        let config = HardwareConfig::default();
        save_config(&config);
        config
    }
}

pub fn save_config(config: &HardwareConfig) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    match serde_json::to_string_pretty(config) {
        Ok(json) => {
            if let Err(e) = fs::write(&path, json) {
                eprintln!("[HardwareConfig] Failed to write config: {}", e);
            }
        }
        Err(e) => eprintln!("[HardwareConfig] Failed to serialize config: {}", e),
    }
}

/// Detect connected hardware and update config with discovered devices.
pub fn auto_detect_hardware() -> HardwareConfig {
    let mut config = load_config();

    // Auto-detect USB printers
    let usb_devices = super::usb_devices::list_usb_devices();
    for device in usb_devices {
        match device.device_type {
            super::usb_devices::DeviceType::Printer => {
                config.receipt_printer.name = device.name.clone();
                config.receipt_printer.vendor_id = Some(device.vendor_id);
                config.receipt_printer.product_id = Some(device.product_id);
                config.receipt_printer.enabled = true;
            }
            super::usb_devices::DeviceType::BarcodeScanner => {
                config.barcode_scanner.enabled = true;
                config.barcode_scanner.mode = "USB_HID".to_string();
            }
            super::usb_devices::DeviceType::Scale => {
                config.scale.enabled = true;
                config.scale.serial_port = super::scale::find_scale_port()
                    .unwrap_or_else(|_| "COM3".to_string());
            }
            _ => {}
        }
    }

    save_config(&config);
    config
}
