use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::webview::Color;
use crate::window::find_game_window;

/// アプリ起動時にオーバーレイウィンドウを裏で生成しておく（事前ロード）
#[tauri::command]
pub async fn init_overlay(app: AppHandle) -> Result<(), String> {
    if app.get_webview_window("overlay").is_none() {
        let builder = WebviewWindowBuilder::new(
            &app,
            "overlay",
            WebviewUrl::App("overlay".into())
        )
        .title("Umamusume Tracker Overlay")
        .transparent(true)
        .shadow(false)
        .background_color(Color(0, 0, 0, 0))
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false) // 初回は非表示のままロードさせる
        .inner_size(320.0, 120.0)
        .position(0.0, 0.0);

        if let Err(e) = builder.build() {
            return Err(format!("オーバーレイ初期化エラー: {}", e));
        }
    }
    Ok(())
}

/// オーバーレイウィンドウを表示（または作成）する
/// ウマ娘のゲームウィンドウの左上に表示する
#[tauri::command]
pub async fn show_overlay(app: AppHandle) -> Result<(), String> {
    // ウマ娘のウィンドウ座標を取得
    let game_win = find_game_window().map_err(|e| e.to_string())?;

    // 左下に配置するための座標計算 (ウィンドウ高さ120px)
    // ウィンドウ内部に十分なパディングがあるため、マージンを足さず直接左下に合わせる
    let pos_x = game_win.client_x as f64;
    let pos_y = game_win.client_y as f64 + game_win.client_height as f64 - 120.0;

    if let Some(overlay) = app.get_webview_window("overlay") {
        // 既に存在する場合は位置を更新して表示
        let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: pos_x as i32,
            y: pos_y as i32,
        }));
        let _ = overlay.show();
    } else {
        // 新規作成
        let builder = WebviewWindowBuilder::new(
            &app,
            "overlay",
            WebviewUrl::App("overlay".into())
        )
        .title("Umamusume Tracker Overlay")
        .transparent(true)
        .shadow(false)
        .background_color(Color(0, 0, 0, 0))
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .inner_size(280.0, 60.0)
        .position(pos_x, pos_y);

        if let Err(e) = builder.build() {
            return Err(format!("オーバーレイウィンドウの作成に失敗しました: {}", e));
        }
    }

    Ok(())
}

/// オーバーレイウィンドウを非表示にする
#[tauri::command]
pub async fn hide_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }
    Ok(())
}
