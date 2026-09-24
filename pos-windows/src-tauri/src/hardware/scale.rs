use serialport::{SerialPort, SerialPortType};
use std::io::{Read, Write};
use std::time::Duration;

#[derive(Debug, Clone, Copy)]
pub enum ScaleProtocol {
    MettlerToledo, // MT-SICS
    AandD,         // A&D format
    GenericRs232,  // Simple ASCII weight
}

pub fn read_weight() -> Result<f64, Box<dyn std::error::Error>> {
    let port_name = find_scale_port()?;
    let mut port = serialport::new(&port_name, 9600)
        .timeout(Duration::from_secs(2))
        .data_bits(serialport::DataBits::Eight)
        .parity(serialport::Parity::None)
        .stop_bits(serialport::StopBits::One)
        .open()
        .map_err(|e| format!("Failed to open scale port: {}", e))?;

    // Send read command (Mettler Toledo SICS)
    port.write_all(b"SI
")?;
    port.flush()?;

    let mut buffer: Vec<u8> = vec![0; 64];
    let n = port.read(&mut buffer)?;
    let response = String::from_utf8_lossy(&buffer[..n]);

    parse_weight(&response)
}

fn find_scale_port() -> Result<String, Box<dyn std::error::Error>> {
    let ports = serialport::available_ports()?;
    for port in ports {
        match port.port_type {
            SerialPortType::UsbPort(info) => {
                if is_scale(info.vid, info.pid) {
                    return Ok(port.port_name);
                }
            }
            SerialPortType::PciPort | SerialPortType::Unknown => {
                // Check port name patterns for built-in RS232
                if port.port_name.contains("COM") {
                    return Ok(port.port_name);
                }
            }
            _ => {}
        }
    }
    Err("No scale found on serial ports".into())
}

fn is_scale(vid: u16, pid: u16) -> bool {
    matches!((vid, pid),
        (0x0590, 0x0012) | // Mettler Toledo
        (0x0dd4, 0x015d)   // A&D
    )
}

fn parse_weight(response: &str) -> Result<f64, Box<dyn std::error::Error>> {
    // Mettler Toledo SICS response: "S S   1.234  kg"
    for line in response.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('S') || trimmed.starts_with('ST') {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            for part in parts {
                if let Ok(weight) = part.parse::<f64>() {
                    return Ok(weight);
                }
            }
        }
    }
    Err(format!("Could not parse weight from: {}", response).into())
}
