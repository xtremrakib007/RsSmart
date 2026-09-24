# RsSmart POS Windows — Hardware Features

## Available Hardware Integrations

### 1. Receipt Printer
- **USB ESC/POS** (Epson TM-series, Bixolon, etc.)
- **Windows Spooler** fallback
- **Offline print queue** — receipts queue automatically when printer disconnected
- **Status polling** — check paper out, cover open, online status
- **Multi-printer support** — receipt, kitchen, label printers configurable

### 2. Cash Drawer
- **Printer-driven kick** — sends ESC/POS pulse command to printer
- Configurable kick command bytes

### 3. Barcode Scanner
- **USB HID mode** — captures keyboard-emulated scanner input (Windows hook)
- **Serial mode** — reads from COM port (Honeywell, Datalogic, Zebra)
- **Scan buffer** — FIFO queue of scanned barcodes
- **Simulation** — `simulate_barcode_scan()` for testing without hardware

### 4. Weighing Scale
- **Mettler Toledo** (MT-SICS protocol)
- **A&D** (FX-i series protocol)
- **Generic RS232**
- Auto-detects scale port

### 5. Hardware Configuration
- **Auto-detect** — scans USB devices and populates config
- **Persistent config** — saved to `%APPDATA%/rssmart/hardware-config.json`
- **Per-device enable/disable** — turn off unused hardware
- **Printer profiles** — 58mm vs 80mm paper width, USB vs network vs spooler

## Tauri Commands (Frontend → Rust)

| Command | Purpose |
|---------|---------|
| `print_receipt(order_id)` | Print receipt; queues if printer offline |
| `open_cash_drawer()` | Kick cash drawer |
| `list_printers()` | List available printers |
| `get_connected_devices()` | List all USB hardware |
| `read_scale()` | Get current weight |
| `read_barcode()` | Pop next barcode from scan buffer |
| `simulate_barcode_scan(barcode)` | Inject test barcode |
| `list_scanner_ports()` | List COM ports with scanner-like devices |
| `clear_scan_buffer()` | Empty the barcode buffer |
| `get_print_queue()` | List queued receipts |
| `process_print_queue()` | Retry all queued receipts |
| `check_printer_status(name)` | Get status of one printer |
| `poll_all_printers()` | Get status of all printers |
| `get_hardware_config()` | Load saved hardware config |
| `save_hardware_config(cfg)` | Save hardware config |
| `auto_detect_hardware()` | Auto-detect and save config |

## Files
- `src/hardware/printer.rs` — ESC/POS printing, Windows spooler
- `src/hardware/printer_queue.rs` — Offline queue, status polling
- `src/hardware/scale.rs` — Serial scale protocols
- `src/hardware/barcode_scanner.rs` — HID & serial scanners
- `src/hardware/usb_devices.rs` — USB device enumeration
- `src/hardware/config.rs` — Persistent configuration
- `src/api/hardware.rs` — Tauri command handlers
