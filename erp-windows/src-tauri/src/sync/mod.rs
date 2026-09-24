use tauri::AppHandle;
use tokio::time::{interval, Duration};

pub fn start_sync_loop(_app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(300));
        loop {
            ticker.tick().await;
            log::info!("Background sync tick");
        }
    });
}
