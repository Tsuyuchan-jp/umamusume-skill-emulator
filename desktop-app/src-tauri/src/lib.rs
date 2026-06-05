use std::sync::atomic::AtomicBool;
/// lib.rs — Tauri アプリケーションのエントリポイント
///
/// 責務:
/// - 共有エラー型 `CaptureError` の定義
/// - キャプチャセッションの共有状態 `CaptureSessionState` の定義
/// - 全 Tauri コマンドの登録
/// - 既存コマンドの互換維持（Step 1 / Step 2 のフロントエンドへの後方互換）
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri::WindowEvent;
mod capture;
mod overlay;
mod stitch;
mod window;

// ============================================================
// 共有エラー型
// ============================================================

/// キャプチャ・結合処理全体で使用するエラー型。
///
/// `thiserror` で `Display` / `Error` を、`serde::Serialize` で
/// Tauri コマンドの戻り値として JSON シリアライズを実現する。
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum CaptureError {
    #[error("ウマ娘のウィンドウが見つかりません。ゲームが起動しているか確認してください。")]
    WindowNotFound,

    #[error("ウィンドウのキャプチャに失敗しました: {0}")]
    CaptureFailed(String),

    #[error("画像の結合に失敗しました: {0}")]
    StitchFailed(String),

    #[error("ファイル操作に失敗しました: {0}")]
    IoError(String),
}

impl From<std::io::Error> for CaptureError {
    fn from(e: std::io::Error) -> Self {
        CaptureError::IoError(e.to_string())
    }
}

// ============================================================
// 共有状態
// ============================================================

/// キャプチャセッション全体で共有する状態。
///
/// Tauri の `manage` に登録し、コマンド関数から `State<'_, CaptureSessionState>` で参照する。
pub struct CaptureSessionState {
    /// キャプチャループの実行フラグ（true = 実行中）
    pub is_recording: Arc<AtomicBool>,
    /// キャプチャ済みフレームのバッファ（クロップ済み）
    pub frames: Arc<Mutex<Vec<image::RgbImage>>>,
}

impl CaptureSessionState {
    pub fn new() -> Self {
        CaptureSessionState {
            is_recording: Arc::new(AtomicBool::new(false)),
            frames: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

// ============================================================
// Tauri エントリポイント
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // キャプチャセッション共有状態を登録
        .manage(CaptureSessionState::new())
        // 全コマンドを登録
        .invoke_handler(tauri::generate_handler![
            // ── キャプチャセッション ──
            capture::start_capture_session,
            capture::stop_capture_session,
            capture::start_auto_scroll_capture_session,
            // ── 画像一時保存（フロントエンド結合用） ──
            stitch::save_and_copy_result,
            // ── ネイティブクリップボード連携 ──
            stitch::copy_image_to_clipboard,
            // ── 結合画像の直接保存 ──
            stitch::save_stitched_image,
            // ── オーバーレイ関連 ──
            overlay::init_overlay,
            overlay::show_overlay,
            overlay::hide_overlay,
        ])
        .setup(|app| {
            // トレイメニューの構築
            let quit_i = MenuItem::with_id(app, "quit", "終了 (Quit)", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "表示 (Show)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // トレイアイコンの構築
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("ウマ娘 レースアナライザー")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // メインウィンドウが閉じられようとした場合
                if window.label() == "main" {
                    // イベントをキャンセルして非表示にする
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("Tauri アプリケーションの起動中にエラーが発生しました");
}
