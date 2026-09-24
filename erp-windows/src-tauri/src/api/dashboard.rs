use crate::db::models::KpiData;
use crate::db::repository::Repository;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_dashboard_kpis(app: AppHandle) -> Result<KpiData, String> {
    let repo = Repository::new(&app)?;
    let accounts = repo.get_chart_of_accounts().await?;
    let products = repo.get_products("tenant-1").await?;
    let orders = repo.get_purchase_orders().await?;
    let approvals = repo.get_approvals().await?;

    let revenue = accounts.iter().filter(|a| a.r#type == "REVENUE").map(|a| a.balance).sum();
    let expenses = accounts.iter().filter(|a| a.r#type == "EXPENSE").map(|a| a.balance).sum();
    let low_stock = products.iter().filter(|p| p.stock_quantity <= p.reorder_level).count() as i64;

    Ok(KpiData {
        revenue, expenses, profit: revenue - expenses, sales_count: 0,
        low_stock_count: low_stock,
        pending_po_count: orders.iter().filter(|o| o.status == "DRAFT" || o.status == "SENT").count() as i64,
        pending_approval_count: approvals.iter().filter(|a| a.status == "PENDING").count() as i64,
    })
}
