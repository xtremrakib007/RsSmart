#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod export;
mod sync;

use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init_database(&handle).await {
                    log::error!("Failed to initialize database: {}", e);
                }
                sync::start_sync_loop(handle.clone());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::product::get_products,
            api::product::get_product,
            api::product::save_product,
            api::product::delete_product,
            api::product::get_inventory_movements,
            api::product::record_movement,
            api::purchase::get_purchase_orders,
            api::purchase::get_purchase_order,
            api::purchase::create_purchase_order,
            api::purchase::update_po_status,
            api::accounting::get_chart_of_accounts,
            api::accounting::get_journal_entries,
            api::accounting::create_journal_entry,
            api::accounting::post_journal_entry,
            api::hr::get_users,
            api::hr::save_user,
            api::hr::delete_user,
            api::audit::get_audit_logs,
            api::approval::get_approvals,
            api::approval::approve_request,
            api::approval::reject_request,
            api::report::generate_report,
            api::report::export_to_excel,
            api::report::export_to_pdf,
            api::dashboard::get_dashboard_kpis,
            api::sync::get_sync_health,
            api::sync::trigger_sync,
            api::branding::get_branding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
