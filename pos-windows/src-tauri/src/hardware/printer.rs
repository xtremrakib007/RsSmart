use escpos_rs::{Printer, PrinterProfile};
use std::io;

pub fn print_esc_pos(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Try USB printers first, then network, then fallback to Windows spooler
    let profile = PrinterProfile::usb_builder()
        .with_vendor_id(0x04b8) // Epson
        .with_product_id(0x0e15)
        .build();

    match Printer::new(profile) {
        Ok(mut printer) => {
            printer.writeln(text)?;
            printer.cut()?;
            Ok(())
        }
        Err(_) => {
            // Fallback: try generic USB or Windows print spooler
            print_via_windows(text)
        }
    }
}

pub fn kick_cash_drawer() -> Result<(), Box<dyn std::error::Error>> {
    let kick_cmd: Vec<u8> = vec![0x1B, 0x70, 0x00, 0x19, 0xFA];

    let profile = PrinterProfile::usb_builder()
        .with_vendor_id(0x04b8)
        .with_product_id(0x0e15)
        .build();

    match Printer::new(profile) {
        Ok(mut printer) => {
            printer.write_raw(&kick_cmd)?;
            Ok(())
        }
        Err(_) => Err("No printer connected for cash drawer".into()),
    }
}

pub fn list_available_printers() -> Vec<(String, String)> {
    let mut printers = Vec::new();

    // Check USB printers
    if let Ok(_) = rusb::Context::new() {
        if let Ok(devices) = rusb::devices() {
            for device in devices.iter() {
                if let Ok(desc) = device.device_descriptor() {
                    if is_printer(desc.vendor_id(), desc.product_id()) {
                        printers.push((
                            format!("USB {:04x}:{:04x}", desc.vendor_id(), desc.product_id()),
                            "USB-ESC/POS".to_string(),
                        ));
                    }
                }
            }
        }
    }

    // Windows network printers would be listed here via winspool API
    printers.push(("Windows Default Printer".to_string(), "SPOOLER".to_string()));

    printers
}

fn is_printer(vid: u16, pid: u16) -> bool {
    matches!((vid, pid),
        (0x04b8, _) | // Epson
        (0x0525, _) | // Generic
        (0x0fe6, _)   // POS-X
    )
}

// Real Windows print-spooler integration: opens the system default printer via the
// winspool API and sends the receipt as a RAW job (raw ESC/POS bytes, no driver
// re-interpretation — the right datatype for receipt printers registered as
// generic/text or raw devices in Windows). This replaces what used to be a no-op
// that only logged a message and returned Ok(()) without printing anything.
#[cfg(windows)]
fn print_via_windows(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW,
        StartPagePrinter, WritePrinter, DOC_INFO_1W,
    };

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    let printer_name = get_default_printer_name()
        .ok_or("No default Windows printer configured")?;
    let mut printer_name_w = to_wide(&printer_name);

    unsafe {
        let mut handle: HANDLE = std::ptr::null_mut();
        if OpenPrinterW(printer_name_w.as_mut_ptr(), &mut handle, ptr::null_mut()) == 0 {
            return Err(format!("Failed to open printer '{}'", printer_name).into());
        }

        let mut doc_name = to_wide("POS Receipt");
        let mut datatype = to_wide("RAW");
        let doc_info = DOC_INFO_1W {
            pDocName: doc_name.as_mut_ptr(),
            pOutputFile: ptr::null_mut(),
            pDatatype: datatype.as_mut_ptr(),
        };

        let job_id = StartDocPrinterW(handle, 1, &doc_info as *const _ as *const u8);
        if job_id == 0 {
            ClosePrinter(handle);
            return Err("StartDocPrinter failed".into());
        }

        if StartPagePrinter(handle) == 0 {
            EndDocPrinter(handle);
            ClosePrinter(handle);
            return Err("StartPagePrinter failed".into());
        }

        // Plain text + line feeds + partial cut (GS V 66 0). Printers that don't
        // support the cut command simply ignore the trailing bytes.
        let mut bytes = text.as_bytes().to_vec();
        bytes.extend_from_slice(b"\n\n\n");
        bytes.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]);

        let mut written: u32 = 0;
        let ok = WritePrinter(handle, bytes.as_ptr() as *const _, bytes.len() as u32, &mut written);

        EndPagePrinter(handle);
        EndDocPrinter(handle);
        ClosePrinter(handle);

        if ok == 0 {
            return Err("WritePrinter failed".into());
        }
        if written as usize != bytes.len() {
            return Err(format!(
                "WritePrinter wrote {} of {} bytes",
                written,
                bytes.len()
            )
            .into());
        }
    }

    Ok(())
}

#[cfg(windows)]
fn get_default_printer_name() -> Option<String> {
    use std::os::windows::ffi::OsStringExt;
    use std::ptr;
    use windows_sys::Win32::Graphics::Printing::GetDefaultPrinterW;

    let mut size: u32 = 0;
    unsafe {
        // First call with a null buffer to get the required size.
        GetDefaultPrinterW(ptr::null_mut(), &mut size);
        if size == 0 {
            return None;
        }
        let mut buf: Vec<u16> = vec![0; size as usize];
        if GetDefaultPrinterW(buf.as_mut_ptr(), &mut size) == 0 {
            return None;
        }
        // Trim the trailing NUL.
        if let Some(&0) = buf.last() {
            buf.pop();
        }
        Some(std::ffi::OsString::from_wide(&buf).to_string_lossy().into_owned())
    }
}

// Non-Windows builds (e.g. running `cargo check` on a dev machine that isn't Windows)
// can't call into winspool — keep behavior explicit instead of silently "succeeding".
#[cfg(not(windows))]
fn print_via_windows(_text: &str) -> Result<(), Box<dyn std::error::Error>> {
    Err("Windows print-spooler fallback is only available when compiled for Windows".into())
}
