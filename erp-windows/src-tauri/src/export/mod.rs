use crate::db::models::ReportFilter;
use tauri::AppHandle;
use std::path::PathBuf;

pub async fn generate_csv(app: &AppHandle, report_type: &str, _filters: &ReportFilter) -> Result<PathBuf, String> {
    let path = PathBuf::from(format!("C:/Users/Public/Documents/{}_report.csv", report_type));
    let repo = crate::db::repository::Repository::new(app)?;

    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;

    match report_type {
        "inventory" => {
            wtr.write_record(&["ID", "SKU", "Name", "Stock", "Reorder", "Price"]).map_err(|e| e.to_string())?;
            let products = repo.get_products("tenant-1").await?;
            for p in products {
                wtr.write_record(&[&p.id, &p.sku, &p.name, &p.stock_quantity.to_string(), &p.reorder_level.to_string(), &p.unit_price.to_string()])
                    .map_err(|e| e.to_string())?;
            }
        }
        "sales" => {
            wtr.write_record(&["Date", "Revenue", "Expenses", "Profit"]).map_err(|e| e.to_string())?;
            wtr.write_record(&["2024-01-01", "1000", "600", "400"]).map_err(|e| e.to_string())?;
        }
        _ => {
            wtr.write_record(&["Report", "Type"]).map_err(|e| e.to_string())?;
            wtr.write_record(&[report_type, "generated"]).map_err(|e| e.to_string())?;
        }
    }

    wtr.flush().map_err(|e| e.to_string())?;
    Ok(path)
}
