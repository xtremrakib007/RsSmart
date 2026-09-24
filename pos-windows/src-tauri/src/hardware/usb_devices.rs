#[derive(Debug, Clone)]
pub enum DeviceType {
    Printer,
    CashDrawer,
    BarcodeScanner,
    Scale,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct UsbDevice {
    pub name: String,
    pub device_type: DeviceType,
    pub vendor_id: u16,
    pub product_id: u16,
    pub is_authorized: bool,
}

pub fn list_usb_devices() -> Vec<UsbDevice> {
    let mut devices = Vec::new();

    if let Ok(ctx) = rusb::Context::new() {
        if let Ok(usb_devices) = ctx.devices() {
            for device in usb_devices.iter() {
                if let Ok(desc) = device.device_descriptor() {
                    let name = device
                        .open()
                        .ok()
                        .and_then(|h| h.read_product_string_ascii(&desc).ok())
                        .unwrap_or_else(|| format!("Device {:04x}:{:04x}", desc.vendor_id(), desc.product_id()));

                    let device_type = classify_device(desc.vendor_id(), desc.product_id());

                    devices.push(UsbDevice {
                        name,
                        device_type,
                        vendor_id: desc.vendor_id(),
                        product_id: desc.product_id(),
                        is_authorized: true, // Would check permissions in real implementation
                    });
                }
            }
        }
    }

    devices
}

fn classify_device(vid: u16, pid: u16) -> DeviceType {
    match vid {
        0x04b8 | 0x0525 => DeviceType::Printer, // Epson / Generic POS
        0x0dd4 => DeviceType::BarcodeScanner,    // Honeywell
        0x0590 | 0x0dd4 if pid == 0x015d => DeviceType::Scale, // Mettler / A&D
        _ => DeviceType::Unknown,
    }
}
