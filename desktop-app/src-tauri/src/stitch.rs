use crate::CaptureError;
/// stitch.rs — フレーム保存用（旧結合処理モジュール）
use tauri::Manager;

/// 蓄積されたフレームを一時フォルダに保存し、そのパスのリストを返す。
/// OpenCV.js（フロントエンド）での結合処理に使用される。
#[tauri::command]
pub async fn save_and_copy_result(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, crate::CaptureSessionState>,
) -> Result<Vec<String>, CaptureError> {
    // std::mem::take を用いて、コピーを発生させずにフレームの所有権を効率的にすり替えて取得する
    let frames = {
        let mut guard = state.frames.lock().unwrap();
        std::mem::take(&mut *guard)
    };

    if frames.is_empty() {
        return Err(CaptureError::StitchFailed(
            "保存するフレームがありません。先にキャプチャを実行してください。".to_string(),
        ));
    }

    // キャッシュディレクトリを取得
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| CaptureError::IoError(format!("キャッシュフォルダの取得に失敗: {}", e)))?;

    // 古いセッションフォルダ（umamusume_frames_*）を全て削除する
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("umamusume_frames") && entry.path().is_dir() {
                if let Err(e) = std::fs::remove_dir_all(entry.path()) {
                    println!(
                        "[Rust/stitch] 古いキャッシュ削除失敗 (スキップ): {} - {}",
                        name_str, e
                    );
                }
            }
        }
    }

    // タイムスタンプ付きのユニークなセッションフォルダを作成
    let session_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_dir = cache_dir.join(format!("umamusume_frames_{}", session_id));
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| CaptureError::IoError(format!("フォルダ作成エラー: {}", e)))?;

    let mut file_paths = Vec::new();

    // 各フレームを連番でPNG保存
    for (i, frame) in frames.iter().enumerate() {
        let file_path = output_dir.join(format!("frame_{:03}.png", i));
        frame
            .save(&file_path)
            .map_err(|e| CaptureError::IoError(format!("PNG 保存エラー: {}", e)))?;

        file_paths.push(file_path.to_string_lossy().to_string());
    }

    println!(
        "[Rust/stitch] {} フレームをセッション {} に一時保存しました",
        file_paths.len(),
        session_id
    );

    Ok(file_paths)
}

use base64::{prelude::BASE64_STANDARD, Engine};

/// Base64形式の画像をデコードし、OSのクリップボードへネイティブにコピーする。
/// これによりブラウザ側の「Document is not focused」制限を完全に回避できる。
#[tauri::command]
pub async fn copy_image_to_clipboard(data_url: String) -> Result<(), String> {
    // 1. Data URLのヘッダを取り除く
    // "data:image/png;base64,iVBORw0..." -> "iVBORw0..."
    let base64_str = if let Some(pos) = data_url.find(",") {
        &data_url[pos + 1..]
    } else {
        &data_url
    };

    // 2. Base64デコード
    let img_bytes = BASE64_STANDARD
        .decode(base64_str)
        .map_err(|e| format!("Base64デコードエラー: {}", e))?;

    // 3. imageクレートでPNGとして読み込む
    let img = image::load_from_memory_with_format(&img_bytes, image::ImageFormat::Png)
        .map_err(|e| format!("画像デコードエラー: {}", e))?;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // 4. arboard を使ってクリップボードへ画像としてコピー
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("クリップボードの初期化に失敗: {}", e))?;

    let img_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: std::borrow::Cow::Borrowed(rgba.as_raw()),
    };

    clipboard
        .set_image(img_data)
        .map_err(|e| format!("クリップボードへの画像コピーに失敗: {}", e))?;

    Ok(())
}

/// Base64形式の画像をデコードし、指定したディレクトリに保存する。
#[tauri::command]
pub async fn save_stitched_image(
    base64_data: String,
    directory: String,
    filename: String,
) -> Result<String, String> {
    // 1. Data URLのヘッダを取り除く
    let base64_str = if let Some(pos) = base64_data.find(",") {
        &base64_data[pos + 1..]
    } else {
        &base64_data
    };

    // 2. Base64デコード
    let img_bytes = BASE64_STANDARD
        .decode(base64_str)
        .map_err(|e| format!("Base64デコードエラー: {}", e))?;

    // 3. パスの構築と保存
    let path = std::path::Path::new(&directory).join(filename);
    std::fs::write(&path, img_bytes).map_err(|e| format!("ファイル書き込みエラー: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
