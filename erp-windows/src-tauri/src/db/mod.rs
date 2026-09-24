pub mod models;
pub mod repository;

use tauri::AppHandle;
use tauri_plugin_sql::SqliteExt;

pub async fn init_database(app: &AppHandle) -> Result<(), String> {
    let db = app.sqlite("retail_erp.db").map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, barcode TEXT UNIQUE,
            name TEXT NOT NULL, description TEXT, category_id TEXT, category_name TEXT,
            unit_price REAL NOT NULL, cost_price REAL, tax_rate REAL DEFAULT 0,
            stock_quantity REAL DEFAULT 0, reorder_level REAL DEFAULT 10,
            unit_of_measure TEXT DEFAULT 'PCS', is_active INTEGER DEFAULT 1,
            image_url TEXT, tenant_id TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now')*1000),
            updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS inventory_movements (
            id TEXT PRIMARY KEY, product_id TEXT, product_name TEXT,
            type TEXT NOT NULL, quantity REAL, unit_cost REAL, total_cost REAL,
            reference TEXT, notes TEXT, created_by TEXT, created_at INTEGER
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY, po_number TEXT UNIQUE, supplier_id TEXT,
            supplier_name TEXT, status TEXT DEFAULT 'DRAFT', subtotal REAL,
            tax_amount REAL, total_amount REAL, expected_delivery INTEGER,
            received_at INTEGER, created_by TEXT, created_at INTEGER,
            approved_by TEXT, approved_at INTEGER
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS purchase_order_items (
            id TEXT PRIMARY KEY, po_id TEXT, product_id TEXT,
            product_name TEXT, quantity REAL, unit_price REAL,
            total_price REAL, received_quantity REAL DEFAULT 0
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS chart_of_accounts (
            id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT,
            type TEXT NOT NULL, parent_id TEXT, balance REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1, tenant_id TEXT
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY, entry_number TEXT UNIQUE,
            date INTEGER, reference TEXT, description TEXT,
            total_debit REAL, total_credit REAL, is_balanced INTEGER,
            status TEXT DEFAULT 'DRAFT', created_by TEXT, created_at INTEGER, posted_at INTEGER
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS journal_lines (
            id TEXT PRIMARY KEY, journal_id TEXT, account_id TEXT,
            account_name TEXT, account_code TEXT, debit REAL, credit REAL, description TEXT
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE, full_name TEXT,
            role TEXT, is_active INTEGER DEFAULT 1, last_login INTEGER,
            created_at INTEGER, permissions TEXT
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT,
            action TEXT, old_values TEXT, new_values TEXT,
            performed_by TEXT, performed_by_name TEXT, ip_address TEXT, timestamp INTEGER
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS approvals (
            id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT,
            entity_name TEXT, requested_by TEXT, requested_by_name TEXT,
            requested_at INTEGER, status TEXT DEFAULT 'PENDING',
            approver_id TEXT, approver_name TEXT, approved_at INTEGER, comments TEXT
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "CREATE TABLE IF NOT EXISTS sync_health (
            device_id TEXT PRIMARY KEY, device_name TEXT,
            last_sync INTEGER, pending_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0, status TEXT, latency_ms INTEGER
        )", vec![],
    ).await.map_err(|e| e.to_string())?;

    let count: i64 = db.select("SELECT COUNT(*) as c FROM chart_of_accounts", vec![])
        .await.map_err(|e| e.to_string())?
        .first().and_then(|r| r.get("c")).and_then(|v| v.as_i64()).unwrap_or(0);

    if count == 0 {
        let accounts = vec![
            ("1000", "Cash", "ASSET"), ("1100", "Inventory", "ASSET"),
            ("1200", "Accounts Receivable", "ASSET"),
            ("2000", "Accounts Payable", "LIABILITY"), ("3000", "Equity", "EQUITY"),
            ("4000", "Sales Revenue", "REVENUE"), ("5000", "Cost of Goods Sold", "EXPENSE"),
            ("5100", "Rent Expense", "EXPENSE"), ("5200", "Salaries", "EXPENSE"),
        ];
        for (code, name, ty) in accounts {
            db.execute(
                "INSERT INTO chart_of_accounts (id, code, name, type, tenant_id) VALUES (?1, ?2, ?3, ?4, 'tenant-1')",
                vec![uuid::Uuid::new_v4().to_string().into(), code.into(), name.into(), ty.into()],
            ).await.ok();
        }
    }

    log::info!("ERP database initialized");
    Ok(())
}
