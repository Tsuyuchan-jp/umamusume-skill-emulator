/// capture.rs — Step 2 & Step 3: スクリーンキャプチャ・クロップ・自動キャプチャループ
///
/// - `capture_window`: BitBlt でウィンドウのクライアント領域を RgbImage として取得
/// - `crop_main_area`: ゲーム仕様 (H * 9/16 - 20px) に基づき左メイン領域をクロップ
/// - `calculate_frame_diff`: 2フレーム間のピクセル差分の絶対値総和を計算
/// - `start_capture_session`: 非同期キャプチャループ（差分監視で自動終了）
/// - `stop_capture_session`: キャプチャの手動中断
///
/// Capture–Stitch 契約（M5）: **wheel / scrollRegionH は stitch（TS）正本**。
/// `capture_frame0_preview` → TS `deriveCaptureWheel` → 本コマンドへ IPC で受け取りセッション固定。
/// - 広帯（scrollRegionH ≥ 280px）→ **-4**（HOF / TRN / CMP 等）
/// - 狭帯（scrollRegionH < 280px）→ **-3**（FRD 等）
use std::sync::atomic::Ordering;
use tauri::Emitter;
use tauri::Manager;

use windows_sys::Win32::Graphics::Gdi::{
    CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
};

use crate::{CaptureError, CaptureSessionState};

/// TS stitch から受け取るホイール決定（セッション内固定）
struct WheelDecision {
    clicks: i16,
    scroll_region_h: i32,
    reason: String,
}

/// ホイール入力カーソルをスクロール帯上端から離す最小 px（狭帯 FRD で上端ギリギリを避ける）
const SCROLL_CURSOR_TOP_MARGIN_PX: i32 = 56;
/// スクロール帯内での Y 位置（上端=0・下端=1）。旧中点 0.5 よりやや下（FRD 安定化・HOF/TRN 帯内に留まる）
const SCROLL_CURSOR_BAND_RATIO: f32 = 0.62;
/// ゲーム UI パネル幅（高さ × 9:16）— stitch `cropCore` フォールバックと同系
const UI_PANEL_ASPECT_WIDTH_RATIO: f32 = 0.5625;

/// スクロール用カーソル X（クライアント座標）。パネルをウィンドウ中央に置いたときの幾何中心（O(1)・追加走査なし）。
fn scroll_panel_center_client_x(client_width: i32, client_height: i32) -> i32 {
    let ui_width = (client_height as f32 * UI_PANEL_ASPECT_WIDTH_RATIO) as i32;
    let panel_left = ((client_width - ui_width) / 2).max(0);
    panel_left + ui_width / 2
}

/// タブ緑ピクセル判定（因子ヘッダー・継承履歴バー用・rgba.ts 正本と同期）
const TAB_GREEN_G_MIN: u8 = 100;
const TAB_GREEN_G_OVER_R: i16 = 30;
const TAB_GREEN_G_OVER_B: i16 = 20;

// ============================================================
// 公開関数
// ============================================================

/// ゲームウィンドウのクライアント領域全体を BitBlt でキャプチャし `RgbImage` を返す。
///
/// Win32 の BitBlt をスクリーン DC から使用するため、ウィンドウが他のウィンドウに
/// 完全に隠れている場合は正しくキャプチャできない点に注意（ウィンドウモードで使用）。
///
/// BGRA (Win32 ネイティブ) → RGB の変換を内部で行う。
pub fn capture_window(
    game_window: &crate::window::GameWindow,
) -> Result<image::RgbImage, CaptureError> {
    let width = game_window.client_width as i32;
    let height = game_window.client_height as i32;

    if width <= 0 || height <= 0 {
        return Err(CaptureError::CaptureFailed(
            "ウィンドウのサイズが無効です（幅または高さが 0 以下）".to_string(),
        ));
    }

    unsafe {
        let hwnd = game_window.hwnd as windows_sys::Win32::Foundation::HWND;
        // ゲームウィンドウ専用の DC を取得
        let hdc_window = GetDC(hwnd);
        if hdc_window.is_null() {
            return Err(CaptureError::CaptureFailed(
                "GetDC(hwnd) の呼び出しに失敗しました".to_string(),
            ));
        }

        // ウィンドウ互換のメモリ DC とビットマップを作成
        let hdc_mem = CreateCompatibleDC(hdc_window);
        if hdc_mem.is_null() {
            ReleaseDC(hwnd, hdc_window);
            return Err(CaptureError::CaptureFailed(
                "CreateCompatibleDC の呼び出しに失敗しました".to_string(),
            ));
        }

        let hbm = CreateCompatibleBitmap(hdc_window, width, height);
        if hbm.is_null() {
            DeleteDC(hdc_mem);
            ReleaseDC(hwnd, hdc_window);
            return Err(CaptureError::CaptureFailed(
                "CreateCompatibleBitmap の呼び出しに失敗しました".to_string(),
            ));
        }

        // ビットマップをメモリ DC に選択（戻り値 = 元のオブジェクト）
        let old_obj = SelectObject(hdc_mem, hbm);

        const PW_CLIENTONLY: u32 = 1;
        const PW_RENDERFULLCONTENT: u32 = 2;
        extern "system" {
            fn PrintWindow(
                hwnd: windows_sys::Win32::Foundation::HWND,
                hdcBlt: windows_sys::Win32::Graphics::Gdi::HDC,
                nFlags: u32,
            ) -> i32;
        }

        let pw_ok = PrintWindow(hwnd, hdc_mem, PW_CLIENTONLY | PW_RENDERFULLCONTENT);

        if pw_ok == 0 {
            SelectObject(hdc_mem, old_obj);
            DeleteObject(hbm);
            DeleteDC(hdc_mem);
            ReleaseDC(hwnd, hdc_window);
            return Err(CaptureError::CaptureFailed(
                "PrintWindow の呼び出しに失敗しました".to_string(),
            ));
        }

        // BITMAPINFO を設定（32bit BGRA、トップダウン）
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height; // 負値 = トップダウン（行が上から下の順）
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32; // BGRA
        bmi.bmiHeader.biCompression = BI_RGB;

        // ピクセルデータを読み出す（32bit BGRA フォーマット）
        let buf_size = (width * height * 4) as usize;
        let mut bgra_buf: Vec<u8> = vec![0u8; buf_size];

        let lines_copied = GetDIBits(
            hdc_mem,
            hbm,
            0,
            height as u32,
            bgra_buf.as_mut_ptr() as *mut std::ffi::c_void,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // リソースの解放
        SelectObject(hdc_mem, old_obj);
        DeleteObject(hbm);
        DeleteDC(hdc_mem);
        ReleaseDC(hwnd, hdc_window);

        if lines_copied == 0 {
            return Err(CaptureError::CaptureFailed(
                "GetDIBits の呼び出しに失敗しました".to_string(),
            ));
        }

        // BGRA → RGB 変換（Win32 は BGRA 順で格納）
        // BGRA byte[0]=B, byte[1]=G, byte[2]=R, byte[3]=A(無視)
        let mut rgb_buf: Vec<u8> = Vec::with_capacity((width * height * 3) as usize);
        for chunk in bgra_buf.chunks_exact(4) {
            rgb_buf.push(chunk[2]); // R
            rgb_buf.push(chunk[1]); // G
            rgb_buf.push(chunk[0]); // B
        }

        let img = image::RgbImage::from_raw(width as u32, height as u32, rgb_buf).ok_or_else(|| {
            CaptureError::CaptureFailed("RgbImage バッファの変換に失敗しました".to_string())
        })?;

        // 単一色（真っ黒など）チェック: APIが成功しても描画されていない場合を検出
        if is_solid_color(&img) {
            return Err(CaptureError::CaptureFailed(
                "キャプチャ画像が単一色（真っ黒等）でした。ハードウェアアクセラレーションやDiscord等のオーバーレイの影響で画面が正しく取得できていない可能性があります。".to_string(),
            ));
        }

        Ok(img)
    }
}

/// ゲーム仕様に従いフレームの左メイン領域をクロップする。
///
/// Steam版ウマ娘の仕様:
/// - 全体のアスペクト比: 16:9
/// - 左側に 9:16 のメイン画面が固定表示される
/// - メイン幅 = `client_height * 0.5625` (= H * 9/16)
/// - スクロールバー除外: 右端から 20px を削除
///
/// 例 (1080p): width = floor(1080 * 0.5625) - 20 = 607 - 20 = 587px

/// 2 フレーム間のピクセル差分の絶対値総和を計算する。
///
/// 戻り値が小さいほど 2 フレームは類似している（スクロール停止の判定に使用）。
/// しきい値は呼び出し側で `total_channels * 5` 等と設定する。
pub fn calculate_frame_diff(a: &image::RgbImage, b: &image::RgbImage) -> u64 {
    // サイズが異なる場合は u64::MAX を返して「差異あり」とみなす
    if a.width() != b.width() || a.height() != b.height() {
        return u64::MAX;
    }
    a.as_raw()
        .iter()
        .zip(b.as_raw().iter())
        .map(|(&x, &y)| (x as i64 - y as i64).unsigned_abs())
        .sum()
}

/// 画像の全ピクセルが同一色かどうかを判定する。
///
/// PrintWindow / BitBlt がAPIレベルでは成功しているが、実際の描画が
/// 取得できていない場合（真っ黒など）を検出するために使用する。
fn is_solid_color(frame: &image::RgbImage) -> bool {
    let mut iter = frame.pixels();
    if let Some(first_pixel) = iter.next() {
        iter.all(|pixel| pixel == first_pixel)
    } else {
        true // 空の画像も単一色と見なす
    }
}

// ============================================================
// Tauri コマンド
// ============================================================

/// キャプチャセッションを開始する（非同期）。
///
/// 内部で連続キャプチャループを実行し、フレーム差分監視によって
/// スクロール終了を検知すると自動的にループを終了する。
/// 取得したフレームは `CaptureSessionState.frames` に蓄積される。
///
/// 完了時に `"capture-complete"` イベントを Tauri ウィンドウにエミットする。
#[tauri::command]
pub async fn start_capture_session(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, CaptureSessionState>,
) -> Result<String, CaptureError> {
    // 多重起動ガード: すでに録画中なら即エラーを返す
    if state
        .is_recording
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(CaptureError::CaptureFailed(
            "すでにキャプチャセッションが実行中です".to_string(),
        ));
    }

    println!("[Rust] キャプチャセッション開始...");

    // 既存フレームをクリア
    {
        let mut frames = state.frames.lock().unwrap();
        frames.clear();
    }

    // ウマ娘のウィンドウを検索
    let game_window = match crate::window::find_game_window() {
        Ok(w) => w,
        Err(e) => {
            state.is_recording.store(false, Ordering::SeqCst);
            return Err(e);
        }
    };

    println!(
        "[Rust] ウィンドウ捕捉: '{}' ({}x{} @ {},{}) — クロップなし（後処理で自動クロップ）",
        game_window.title,
        game_window.client_width,
        game_window.client_height,
        game_window.client_x,
        game_window.client_y,
    );

    let mut prev_frame: Option<image::RgbImage> = None;
    let mut phase = 1;
    let mut stop_counter = 0; // スクロール停止の猶予カウンタ
    let mut consecutive_capture_errors = 0u32; // 連続キャプチャ失敗カウンタ

    // ── キャプチャループ ──────────────────────────────────────
    loop {
        // 手動停止シグナルのチェック
        if !state.is_recording.load(Ordering::Relaxed) {
            println!("[Rust] キャプチャ: 手動停止シグナルを受信しました。");
            break;
        }

        // フレームキャプチャ（失敗した場合は連続エラーをカウントし、3回で強制終了）
        let raw_frame = match capture_window(&game_window) {
            Ok(f) => {
                consecutive_capture_errors = 0; // 成功したらカウンタをリセット
                f
            }
            Err(e) => {
                consecutive_capture_errors += 1;
                log::warn!("フレームキャプチャ失敗 ({}/3): {}", consecutive_capture_errors, e);
                if consecutive_capture_errors >= 3 {
                    state.is_recording.store(false, Ordering::SeqCst);
                    return Err(CaptureError::CaptureFailed(format!(
                        "連続してキャプチャに失敗しました。原因: {}。ハードウェアアクセラレーションやオーバーレイ系ソフトの影響の可能性があります。",
                        e
                    )));
                }
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                continue;
            }
        };

        let total_channels = (raw_frame.width() * raw_frame.height() * 3) as u64;
        // スクロール部分は画面全体の一部であるため、1チャンネルあたりの平均差分は小さくなります。
        // デバッグログの結果を元に、適切な値に調整できるよう少し下げておきます。
        let stop_threshold = total_channels * 2;
        let start_threshold = total_channels * 3;

        if let Some(ref prev) = prev_frame {
            let diff = calculate_frame_diff(prev, &raw_frame);

            if phase == 1 {
                if diff >= start_threshold {
                    phase = 2;
                    stop_counter = 0;
                    // スクロールが開始されたので、ここから本番バッファへ蓄積開始
                    // 開始直前の静止フレーム（prev）と、現在のフレーム（raw_frame）を保持
                    let mut frames = state.frames.lock().unwrap();
                    frames.clear(); // 念のためクリア
                    frames.push(prev.clone());
                    frames.push(raw_frame.clone());
                }
            } else if phase == 2 {
                if diff < stop_threshold {
                    stop_counter += 1;
                    if stop_counter >= 3 {
                        println!("Phase 3: Stopped.");
                        let mut frames = state.frames.lock().unwrap();
                        frames.push(raw_frame.clone());
                        break;
                    } else {
                        // 猶予期間中もバッファに蓄積する
                        let mut frames = state.frames.lock().unwrap();
                        frames.push(raw_frame.clone());
                    }
                } else {
                    stop_counter = 0; // 動きが戻ったのでカウンタをリセット
                                      // スクロール中なのでバッファに蓄積
                    let mut frames = state.frames.lock().unwrap();
                    frames.push(raw_frame.clone());
                }
            }
        }

        // フレームを蓄積（次回比較用にクローンを保持）
        // フェーズ1の待機中も常に最新フレームで更新される
        prev_frame = Some(raw_frame);

        // 次のキャプチャまで待機（FPS制限: 約5FPSに下げて処理時間とミスを削減）
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    // ── ループ終了 ────────────────────────────────────────────

    state.is_recording.store(false, Ordering::SeqCst);

    let frame_count = state.frames.lock().unwrap().len();
    println!("[Rust] キャプチャ完了: {} フレーム取得", frame_count);

    // 0フレームの場合はエラーとして返し、capture-complete を発火しない
    // （発火すると TS 側で save_and_copy_result が呼ばれ「フレームなし」エラーになるため）
    if frame_count == 0 {
        return Err(CaptureError::CaptureFailed(
            "キャプチャは完了しましたが、有効なフレームが1枚も取得できませんでした。スクロールが正しく実行されたか確認してください。".to_string(),
        ));
    }

    // フレームをディスクに即時保存（メモリバッファの競合を回避するため）
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| CaptureError::IoError(format!("キャッシュフォルダの取得に失敗: {}", e)))?;

    // 古いセッションフォルダを削除
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("umamusume_frames") && entry.path().is_dir() {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }

    let session_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let output_dir = cache_dir.join(format!("umamusume_frames_{}", session_id));
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| CaptureError::IoError(format!("フォルダ作成エラー: {}", e)))?;

    // フレームをPNGとして保存
    {
        let frames = state.frames.lock().unwrap();
        for (i, frame) in frames.iter().enumerate() {
            let file_path = output_dir.join(format!("frame_{:03}.png", i));
            frame.save(&file_path)
                .map_err(|e| CaptureError::IoError(format!("フレーム保存エラー: {}", e)))?;
        }
    }

    // 保存先パスを共有状態に記録
    {
        let mut dir_guard = state.last_frame_dir.lock().unwrap();
        *dir_guard = Some(output_dir.to_string_lossy().to_string());
    }

    println!("[Rust] フレームを {} に保存しました", output_dir.display());

    // capture-complete イベントにフレーム数とディレクトリパスを含める
    let payload = serde_json::json!({
        "frameCount": frame_count,
        "frameDir": output_dir.to_string_lossy().to_string()
    });
    let _ = app_handle.emit("capture-complete", payload);

    Ok(format!(
        "キャプチャ完了: {} フレームを取得しました。「保存して結合」ボタンで画像を生成できます。",
        frame_count
    ))
}

/// キャプチャセッションを手動で中断する。
///
/// `is_recording` フラグを `false` に設定することで、
/// `start_capture_session` のループを次のイテレーションで停止させる。
#[tauri::command]
pub async fn stop_capture_session(
    state: tauri::State<'_, CaptureSessionState>,
) -> Result<String, CaptureError> {
    if state.is_recording.load(Ordering::Relaxed) {
        state.is_recording.store(false, Ordering::SeqCst);
        println!("[Rust] キャプチャ停止シグナルを送信しました。");
        Ok("キャプチャを停止しています...".to_string())
    } else {
        Ok("キャプチャは実行されていません。".to_string())
    }
}

use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_MOUSE, MOUSEEVENTF_WHEEL, MOUSEINPUT,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, SetCursorPos, SetForegroundWindow,
};

/// タブ緑ピクセル判定（因子ヘッダー・継承履歴バー用・rgba.ts 正本と同期）
fn is_tab_green_rgb(r: u8, g: u8, b: u8) -> bool {
    g >= TAB_GREEN_G_MIN
        && (g as i16) > (r as i16) + TAB_GREEN_G_OVER_R
        && (g as i16) > (b as i16) + TAB_GREEN_G_OVER_B
}

fn log_wheel_decision(decision: &WheelDecision) {
    if decision.scroll_region_h <= 0 {
        println!(
            "[Rust] scrollRegion=?px wheel={} reason={}",
            decision.clicks, decision.reason
        );
    } else {
        println!(
            "[Rust] scrollRegion={}px wheel={} reason={}",
            decision.scroll_region_h, decision.clicks, decision.reason
        );
    }
}

fn wheel_decision_payload(decision: &WheelDecision) -> serde_json::Value {
    serde_json::json!({
        "wheel": decision.clicks,
        "scrollRegionH": if decision.scroll_region_h > 0 {
            serde_json::Value::from(decision.scroll_region_h)
        } else {
            serde_json::Value::Null
        },
        "reason": decision.reason
    })
}

fn emit_wheel_decision(app_handle: &tauri::AppHandle, decision: &WheelDecision) {
    log_wheel_decision(decision);
    let _ = app_handle.emit("capture-wheel-decision", wheel_decision_payload(decision));
}

/// frame0 をキャプチャしてプレビュー PNG を返す（M5: TS stitch が wheel を決定する前提）
#[tauri::command]
pub async fn capture_frame0_preview(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, CaptureSessionState>,
) -> Result<String, CaptureError> {
    if state.is_recording.load(Ordering::Relaxed) {
        return Err(CaptureError::CaptureFailed(
            "すでにキャプチャセッションが実行中です".to_string(),
        ));
    }

    let game_window = crate::window::find_game_window()?;
    let frame = capture_window(&game_window)?;

    {
        let mut frames = state.frames.lock().unwrap();
        frames.clear();
        frames.push(frame.clone());
    }

    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| CaptureError::IoError(format!("キャッシュフォルダの取得に失敗: {}", e)))?;

    let preview_dir = cache_dir.join("frame0_preview");
    std::fs::create_dir_all(&preview_dir)
        .map_err(|e| CaptureError::IoError(format!("プレビューフォルダ作成エラー: {}", e)))?;

    let file_path = preview_dir.join("frame_000.png");
    frame
        .save(&file_path)
        .map_err(|e| CaptureError::IoError(format!("frame0 保存エラー: {}", e)))?;

    Ok(file_path.to_string_lossy().to_string())
}

// 最初のフレームから因子ヘッダーの「左端」と「右端」、そして「Y座標」を動的に見つけ出す関数
fn find_factor_header_bounds(frame: &image::RgbImage) -> (u32, u32, u32) {
    let width = frame.width();
    let height = frame.height();
    let ui_width = (height as f32 * 0.5625) as u32;
    let min_len = (ui_width as f32 * 0.50) as u32;
    let max_len = (ui_width as f32 * 1.10) as u32;

    let search_start_y = (height as f32 * 0.20) as u32;
    let search_end_y = (height as f32 * 0.50) as u32;

    let mut best_bounds = None;
    let mut best_len = 0;
    let mut best_y = 0;

    for y in search_start_y..search_end_y {
        let mut first_green = None;
        let mut last_green = None;

        for x in 0..width {
            let pixel = frame.get_pixel(x, y);
            if is_tab_green_rgb(pixel[0], pixel[1], pixel[2]) {
                if first_green.is_none() {
                    first_green = Some(x);
                }
                last_green = Some(x);
            }
        }

        if let (Some(first), Some(last)) = (first_green, last_green) {
            let current_len = last.saturating_sub(first);
            // 白文字などで途切れていても、「最初から最後までの距離」が規定以上の長さならヘッダーと見なす
            if current_len > min_len && current_len <= max_len && current_len > best_len {
                best_len = current_len;
                best_bounds = Some((first, last));
                best_y = y;
            }
        }
    }

    // 見つかればその両端とY座標、見つからなければフォールバックを返す
    if let Some((first, last)) = best_bounds {
        (first, last, best_y)
    } else {
        let fallback_center = if width > height as u32 {
            width / 4
        } else {
            width / 2
        };
        let half_w = (ui_width as f32 * 0.40) as u32;
        let fallback_y = (height as f32 * 0.30) as u32; // 推定されるヘッダーのY座標のデフォルト値
        (
            fallback_center.saturating_sub(half_w),
            fallback_center + half_w,
            fallback_y,
        )
    }
}

fn detect_green_history_bar(frame: &image::RgbImage, start_x: u32, end_x: u32) -> bool {
    let height = frame.height();
    let width = frame.width();

    // Y座標: 50% 〜 85% の広大な領域をスキャンする。
    // スクロール速度が速くて飛び越えてしまう現象（ワープ）を完全に防ぐ。
    let start_y = (height as f32 * 0.50) as u32;
    let end_y = (height as f32 * 0.85) as u32;

    let scan_width = end_x.saturating_sub(start_x);
    // スキャン領域のうち、70%が緑色なら「継承履歴バー」と判定
    let threshold = (scan_width as f32 * 0.70) as u32;

    for y in start_y..end_y {
        let mut green_count = 0;
        for x in start_x..end_x {
            if x < width && y < height {
                let pixel = frame.get_pixel(x, y);
                if is_tab_green_rgb(pixel[0], pixel[1], pixel[2]) {
                    green_count += 1;
                }
            }
        }
        if green_count > threshold {
            return true;
        }
    }
    false
}

/// ウマ娘のウィンドウにフォーカスを当てて、マウスホイールスクロールを送信する
fn scroll_window_input(hwnd: isize, target_x: i32, target_y: i32, clicks: i16) {
    unsafe {
        // 現在のマウスカーソル位置を保存
        let mut pt = POINT { x: 0, y: 0 };
        GetCursorPos(&mut pt);

        // 対象ウィンドウをアクティブ（フォアグラウンド）にする
        SetForegroundWindow(hwnd as _);
        // マウスカーソルを計算済みのターゲット座標に移動
        SetCursorPos(target_x, target_y);

        // わずかな遅延（フォーカス切り替えとカーソル移動の安定化）
        std::thread::sleep(std::time::Duration::from_millis(50));

        let count = clicks.abs();
        let direction = if clicks > 0 { 120 } else { -120 };

        for _ in 0..count {
            let mut input: INPUT = std::mem::zeroed();
            input.r#type = INPUT_MOUSE;
            input.Anonymous.mi = MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: direction as u32,
                dwFlags: MOUSEEVENTF_WHEEL,
                time: 0,
                dwExtraInfo: 0,
            };
            SendInput(1, &input, std::mem::size_of::<INPUT>() as i32);
            std::thread::sleep(std::time::Duration::from_millis(20)); // 連続送信の間隔
        }

        // ゲーム側が最後のスクロールイベントを処理するまで少し待機
        std::thread::sleep(std::time::Duration::from_millis(50));

        // マウスカーソルを元の位置に戻す
        SetCursorPos(pt.x, pt.y);
    }
}

/// 自動スクロールを用いたキャプチャセッション（M5: wheel は TS stitch 正本から IPC 受信）
#[tauri::command]
pub async fn start_auto_scroll_capture_session(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, CaptureSessionState>,
    wheel: i16,
    scroll_region_h: i32,
    reason: String,
) -> Result<String, CaptureError> {
    if state
        .is_recording
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(CaptureError::CaptureFailed(
            "すでにキャプチャセッションが実行中です".to_string(),
        ));
    }

    println!("[Rust] 自動スクロールキャプチャセッション開始...");

    let wheel_decision = WheelDecision {
        clicks: wheel,
        scroll_region_h,
        reason: reason.clone(),
    };
    emit_wheel_decision(&app_handle, &wheel_decision);

    let game_window = match crate::window::find_game_window() {
        Ok(w) => w,
        Err(e) => {
            state.is_recording.store(false, Ordering::SeqCst);
            return Err(e);
        }
    };

    // frame0: プレビュー済みなら再利用、なければ新規キャプチャ
    let (mut prev_frame, factor_start_x, factor_end_x, header_y) = {
        let preview_frame = {
            let frames_guard = state.frames.lock().unwrap();
            frames_guard.first().cloned()
        };

        let frame0 = if let Some(f) = preview_frame {
            f
        } else {
            match capture_window(&game_window) {
                Ok(f) => {
                    let mut frames = state.frames.lock().unwrap();
                    frames.push(f.clone());
                    f
                }
                Err(e) => {
                    state.is_recording.store(false, Ordering::SeqCst);
                    return Err(e);
                }
            }
        };

        let bounds = find_factor_header_bounds(&frame0);
        let start_x = bounds.0;
        let end_x = bounds.1;
        let h_y = bounds.2;
        println!(
            "[Rust] 因子ヘッダー検知: X座標 {} 〜 {}, Y座標 {}",
            start_x, end_x, h_y
        );

        (Some(frame0), start_x, end_x, h_y)
    };

    // スクロールのアンカーとなるマウス座標（画面全体に対する絶対座標）を計算
    // X: UI パネル幾何中心（factor 緑帯中点は左端ノイズで HOF/FRD-release が左寄りになりうるため使わない）
    let target_client_x =
        scroll_panel_center_client_x(game_window.client_width, game_window.client_height);
    let factor_mid_x = (factor_start_x + factor_end_x) as i32 / 2;
    // スクロールエリアはヘッダー（header_y）からウィンドウ下部90%（client_height * 0.90）まで続く。
    // ホイールは帯の上端ギリギリだと FRD 等で不安定になりうるため、上端マージンと帯比率の大きい方を採用。
    let scroll_area_start_y = header_y as i32;
    let scroll_area_end_y = (game_window.client_height as f32 * 0.90) as i32;
    let scroll_band_h = (scroll_area_end_y - scroll_area_start_y).max(1);
    let from_ratio =
        scroll_area_start_y + (scroll_band_h as f32 * SCROLL_CURSOR_BAND_RATIO) as i32;
    let from_margin = scroll_area_start_y + SCROLL_CURSOR_TOP_MARGIN_PX;
    let target_client_y = from_ratio
        .max(from_margin)
        .min(scroll_area_end_y.saturating_sub(8));
    println!(
        "[Rust] スクロール用カーソル: X={} (UI中心 factor帯 {}–{} 中点 {}), Y={} (帯 {}–{} 高さ {}px margin={} ratio={})",
        target_client_x,
        factor_start_x,
        factor_end_x,
        factor_mid_x,
        target_client_y,
        scroll_area_start_y,
        scroll_area_end_y,
        scroll_band_h,
        SCROLL_CURSOR_TOP_MARGIN_PX,
        SCROLL_CURSOR_BAND_RATIO
    );

    let absolute_target_x = game_window.client_x + target_client_x;
    let absolute_target_y = game_window.client_y + target_client_y;

    let mut consecutive_capture_errors = 0u32; // 連続キャプチャ失敗カウンタ

    // スクロール＆キャプチャループ
    loop {
        if !state.is_recording.load(Ordering::Relaxed) {
            break;
        }

        // ホイール下方向にスクロール
        // ターゲット座標に向かってスクロールを実行する
        scroll_window_input(
            game_window.hwnd,
            absolute_target_x,
            absolute_target_y,
            wheel_decision.clicks,
        );

        // スクロールアニメーションの完了とバウンドの停止を待つ
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let raw_frame = match capture_window(&game_window) {
            Ok(f) => {
                consecutive_capture_errors = 0;
                f
            }
            Err(e) => {
                consecutive_capture_errors += 1;
                log::warn!("キャプチャ失敗 ({}/3): {}", consecutive_capture_errors, e);
                if consecutive_capture_errors >= 3 {
                    state.is_recording.store(false, Ordering::SeqCst);
                    return Err(CaptureError::CaptureFailed(format!(
                        "連続してキャプチャに失敗しました。原因: {}。ハードウェアアクセラレーションやオーバーレイ系ソフトの影響の可能性があります。",
                        e
                    )));
                }
                continue;
            }
        };

        // --- ストッパー1: 継承履歴到達時の早期終了（ダイナミックセーフボックス検知） ---
        if detect_green_history_bar(&raw_frame, factor_start_x, factor_end_x) {
            println!("[Rust] 継承履歴バーを検知。早期終了します。");
            let mut frames = state.frames.lock().unwrap();
            frames.push(raw_frame.clone()); // 結合＆クロップのために最後の1枚も保存する
            break;
        }
        // -------------------------------------------------------------------------

        let total_channels = (raw_frame.width() * raw_frame.height() * 3) as u64;
        let stop_threshold = total_channels * 2;

        if let Some(ref prev) = prev_frame {
            let diff = calculate_frame_diff(prev, &raw_frame);

            // スクロール前後で差分がほとんどない＝一番下に到達した（バウンドが終了し元の位置に戻った）
            if diff < stop_threshold {
                println!("[Rust] スクロール末端に到達しました。");
                break;
            }
        }

        {
            let mut frames = state.frames.lock().unwrap();
            frames.push(raw_frame.clone());
        }
        prev_frame = Some(raw_frame);
    }

    state.is_recording.store(false, Ordering::SeqCst);
    let frame_count = state.frames.lock().unwrap().len();
    println!("[Rust] 自動キャプチャ完了: {} フレーム取得", frame_count);

    // 0フレームの場合はエラーとして返し、capture-complete を発火しない
    if frame_count == 0 {
        return Err(CaptureError::CaptureFailed(
            "キャプチャは完了しましたが、有効なフレームが1枚も取得できませんでした。ゲーム画面が正しく表示されているか確認してください。".to_string(),
        ));
    }

    // フレームをディスクに即時保存（メモリバッファの競合を回避するため）
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| CaptureError::IoError(format!("キャッシュフォルダの取得に失敗: {}", e)))?;

    // 古いセッションフォルダを削除
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("umamusume_frames") && entry.path().is_dir() {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }

    let session_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let output_dir = cache_dir.join(format!("umamusume_frames_{}", session_id));
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| CaptureError::IoError(format!("フォルダ作成エラー: {}", e)))?;

    // フレームをPNGとして保存
    {
        let frames = state.frames.lock().unwrap();
        for (i, frame) in frames.iter().enumerate() {
            let file_path = output_dir.join(format!("frame_{:03}.png", i));
            frame.save(&file_path)
                .map_err(|e| CaptureError::IoError(format!("フレーム保存エラー: {}", e)))?;
        }
    }

    // 保存先パスを共有状態に記録
    {
        let mut dir_guard = state.last_frame_dir.lock().unwrap();
        *dir_guard = Some(output_dir.to_string_lossy().to_string());
    }

    println!("[Rust] フレームを {} に保存しました", output_dir.display());

    // capture-complete イベントにフレーム数・wheel 推定を含める
    let mut payload = serde_json::json!({
        "frameCount": frame_count,
        "frameDir": output_dir.to_string_lossy().to_string()
    });
    if let Some(obj) = payload.as_object_mut() {
        obj.extend(
            wheel_decision_payload(&wheel_decision)
                .as_object()
                .cloned()
                .unwrap_or_default(),
        );
    }
    let _ = app_handle.emit("capture-complete", payload);

    Ok(format!(
        "自動キャプチャ完了: {} フレームを取得しました。",
        frame_count
    ))
}
