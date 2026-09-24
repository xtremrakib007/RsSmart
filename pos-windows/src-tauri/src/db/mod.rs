pub mod models;
pub mod repository;

use tauri::AppHandle;
use tauri_plugin_sql::SqliteExt;

pub async fn init_database(app: &AppHandle) -> Result<(), String> {
    let db = app.sqlite("retail_pos.db").map_err(|e| e.to_string())?;

    // Products table
    db.execute(
        "CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            sku TEXT NOT NULL UNIQUE,
            barcode TEXT UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            category_id TEXT,
            unit_price REAL NOT NULL,
            cost_price REAL,
            tax_rate REAL DEFAULT 0.0,
            stock_quantity REAL DEFAULT 0.0,
            unit_of_measure TEXT DEFAULT 'PCS',
            is_active INTEGER DEFAULT 1,
            image_url TEXT,
            tenant_id TEXT NOT NULL,
            sync_status TEXT DEFAULT 'SYNCED',
            last_modified INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            server_version INTEGER DEFAULT 0
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Cart items (ephemeral, per session)
    db.execute(
        "CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            quantity REAL NOT NULL,
            discount_amount REAL DEFAULT 0.0,
            tax_amount REAL DEFAULT 0.0,
            line_total REAL NOT NULL,
            notes TEXT
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // POS Sessions
    db.execute(
        "CREATE TABLE IF NOT EXISTS pos_sessions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            opening_cash REAL NOT NULL,
            closing_cash REAL,
            expected_cash REAL,
            cash_difference REAL,
            total_sales REAL DEFAULT 0.0,
            total_refunds REAL DEFAULT 0.0,
            transaction_count INTEGER DEFAULT 0,
            opened_at INTEGER NOT NULL,
            closed_at INTEGER,
            status TEXT DEFAULT 'OPEN',
            notes TEXT,
            sync_status TEXT DEFAULT 'PENDING'
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Orders
    db.execute(
        "CREATE TABLE IF NOT EXISTS pos_orders (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            receipt_number TEXT NOT NULL UNIQUE,
            subtotal REAL NOT NULL,
            total_discount REAL DEFAULT 0.0,
            total_tax REAL DEFAULT 0.0,
            grand_total REAL NOT NULL,
            customer_id TEXT,
            customer_name TEXT,
            item_count INTEGER NOT NULL,
            status TEXT DEFAULT 'COMPLETED',
            is_offline INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            sync_status TEXT DEFAULT 'PENDING',
            server_version INTEGER DEFAULT 0
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Payments
    db.execute(
        "CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            card_last_four TEXT,
            card_type TEXT,
            mobile_provider TEXT,
            mobile_reference TEXT,
            is_refund INTEGER DEFAULT 0,
            processed_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            sync_status TEXT DEFAULT 'PENDING',
            receipt_number TEXT
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Offline Queue
    db.execute(
        "CREATE TABLE IF NOT EXISTS offline_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER DEFAULT 5,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 5,
            status TEXT DEFAULT 'PENDING',
            error_message TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            last_attempt INTEGER
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Indexes
    db.execute("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)", vec![]).await.ok();
    db.execute("CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id)", vec![]).await.ok();
    db.execute("CREATE INDEX IF NOT EXISTS idx_orders_session ON pos_orders(session_id)", vec![]).await.ok();
    db.execute("CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue(status)", vec![]).await.ok();

    // Order line items — previously PosOrder only stored aggregate totals, so
    // there was no way to reconstruct per-line detail for sync. The real
    // backend's checkout endpoint requires item-level detail (productId,
    // quantity, unitPrice, discount), so this table persists it at checkout time.
    db.execute(
        "CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            discount_amount REAL DEFAULT 0.0,
            tax_amount REAL DEFAULT 0.0,
            line_total REAL NOT NULL
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;
    db.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)", vec![]).await.ok();

    // Server-assigned session ID, filled in once a session's OPEN event syncs.
    // Close/checkout calls need the *server's* session ID, not the local one.
    db.execute("ALTER TABLE pos_sessions ADD COLUMN server_id TEXT", vec![]).await.ok();

    // Logged-in user/tenant + tokens for this device. A single-row table
    // (id = 1) — the desktop app is single-user-at-a-time per install.
    // Previously there was no auth/session concept at all: tenant_id,
    // user_id and device_id were hardcoded constants, and sync sent no
    // Authorization header, so every sync call would 401 against a real
    // backend.
    db.execute(
        "CREATE TABLE IF NOT EXISTS auth_session (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            email TEXT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Persistent per-machine device ID, generated once on first run and
    // reused across logins/logouts (distinct from the transient auth_session
    // above so the server always sees the same device for a given machine).
    db.execute(
        "CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        vec![],
    )
    .await
    .map_err(|e| e.to_string())?;

    log::info!("Database initialized successfully");
    Ok(())
}
