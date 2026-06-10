use keyring::{Entry, Error};

/// Windows Credential Manager の Service 名（tauri.conf.json identifier と一致）
const SERVICE: &str = "com.umamusume.race-analyzer";
/// Credential Manager の Entry 名
const ENTRY: &str = "gemini_api_key";

fn get_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ENTRY).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_gemini_api_key(key: String) -> Result<(), String> {
    let entry = get_entry()?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_gemini_api_key() -> Result<Option<String>, String> {
    let entry = get_entry()?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn has_gemini_api_key() -> Result<bool, String> {
    let entry = get_entry()?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_gemini_api_key() -> Result<(), String> {
    let entry = get_entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
