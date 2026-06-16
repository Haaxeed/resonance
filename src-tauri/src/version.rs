use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct AppInfo {
    pub version: String,
    pub author: String,
}

pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        author: env!("CARGO_PKG_AUTHORS").to_string(),
    }
}
