use crate::CaptureError;
/// stitch.rs — フレーム保存用（旧結合処理モジュール）

/// キャプチャ済みフレームのファイルパスリストを返す。
/// フレームはキャプチャ完了時にディスクに保存済みのため、
/// ここではパスの読み出しのみを行う。
#[tauri::command]
pub async fn save_and_copy_result(
    state: tauri::State<'_, crate::CaptureSessionState>,
) -> Result<Vec<String>, CaptureError> {
    // キャプチャ時に保存されたフレームディレクトリを取得
    let frame_dir = {
        let guard = state.last_frame_dir.lock().unwrap();
        guard.clone()
    };

    let frame_dir = frame_dir.ok_or_else(|| {
        CaptureError::StitchFailed(
            "保存するフレームがありません。先にキャプチャを実行してください。".to_string(),
        )
    })?;

    let dir_path = std::path::Path::new(&frame_dir);
    if !dir_path.exists() {
        return Err(CaptureError::StitchFailed(
            "フレームの保存フォルダが見つかりません。再度キャプチャを実行してください。".to_string(),
        ));
    }

    // ディレクトリ内の frame_*.png をソートして返す
    let mut file_paths: Vec<String> = Vec::new();
    let mut entries: Vec<_> = std::fs::read_dir(dir_path)
        .map_err(|e| CaptureError::IoError(format!("フォルダ読み込みエラー: {}", e)))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .file_name()
                .map(|n| n.to_string_lossy().starts_with("frame_") && n.to_string_lossy().ends_with(".png"))
                .unwrap_or(false)
        })
        .collect();

    // ファイル名でソート（frame_000.png, frame_001.png, ...）
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        file_paths.push(entry.path().to_string_lossy().to_string());
    }

    if file_paths.is_empty() {
        return Err(CaptureError::StitchFailed(
            "保存するフレームがありません。先にキャプチャを実行してください。".to_string(),
        ));
    }

    println!(
        "[Rust/stitch] ディスクから {} フレームを読み込みました: {}",
        file_paths.len(),
        frame_dir
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
