#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod hardware;
mod sync;

use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Initialize database
                if let Err(e) = db::init_database(&handle).await {
                    log::error!("Failed to initialize database: {}", e);
                }
                // Start background sync
                sync::start_sync_loop(handle.clone());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::session::open_session,
            api::session::close_session,
            api::session::get_open_session,
            api::product::get_products,
            api::product::search_products,
            api::product::get_product_by_barcode,
            api::order::create_order,
            api::order::get_orders_by_session,
            api::payment::record_payment,
            api::refund::process_refund,
            api::sync::get_pending_sync_count,
            api::sync::trigger_sync,
            api::sync::get_offline_queue,
            api::branding::get_branding,
            api::auth::login,
            api::auth::logout,
            api::auth::get_auth_status,
            api::hardware::print_receipt,
            api::hardware::open_cash_drawer,
            api::hardware::list_printers,
            api::hardware::get_connected_devices,
            api::hardware::read_scale,
            // Barcode scanner
            api::hardware::read_barcode,
            api::hardware::simulate_barcode_scan,
            api::hardware::list_scanner_ports,
            api::hardware::clear_scan_buffer,
            // Print queue & status
            api::hardware::get_print_queue,
            api::hardware::process_print_queue,
            api::hardware::check_printer_status,
            api::hardware::poll_all_printers,
            // Hardware config
            api::hardware::get_hardware_config,
            api::hardware::save_hardware_config,
            api::hardware::auto_detect_hardware,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
