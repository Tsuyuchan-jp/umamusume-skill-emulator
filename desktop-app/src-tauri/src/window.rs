/// window.rs — Step 1 & Step 2 リファクタ版
/// ウマ娘のゲームウィンドウを特定し、クライアント領域のスクリーン座標を返す。
use windows_sys::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetClientRect, GetWindowTextLengthW, GetWindowTextW,
    IsWindowVisible, SetProcessDPIAware,
};

use crate::CaptureError;

/// ゲームウィンドウの情報（クライアント領域のスクリーン座標付き）
#[derive(Debug, Clone, serde::Serialize)]
pub struct GameWindow {
    /// Win32 のウィンドウハンドル（isize として保持）
    pub hwnd: isize,
    /// ウィンドウタイトル
    pub title: String,
    /// クライアント領域の左上 X 座標（スクリーン絶対座標）
    pub client_x: i32,
    /// クライアント領域の左上 Y 座標（スクリーン絶対座標）
    pub client_y: i32,
    /// クライアント領域の幅（ピクセル）— タイトルバー・枠を除く
    pub client_width: u32,
    /// クライアント領域の高さ（ピクセル）— タイトルバー・枠を除く
    pub client_height: u32,
}

/// EnumWindows コールバックに渡す探索状態
struct SearchState {
    found_hwnd: Option<HWND>,
    found_title: String,
}

/// EnumWindows コールバック関数
/// - 非表示ウィンドウはスキップ
/// - タイトルに「ウマ娘」を含む最初のウィンドウで探索を終了
unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> i32 {
    let state = &mut *(lparam as *mut SearchState);

    // 非表示ウィンドウはスキップ
    if IsWindowVisible(hwnd) == 0 {
        return 1; // 列挙を続ける
    }

    // タイトルの長さを確認（0 なら無名ウィンドウ → スキップ）
    let len = GetWindowTextLengthW(hwnd);
    if len == 0 {
        return 1;
    }

    // タイトル文字列を UTF-16 で取得
    let mut buf = vec![0u16; (len + 1) as usize];
    let actual = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
    if actual > 0 {
        let title_raw = String::from_utf16_lossy(&buf[..actual as usize]);
        let title = title_raw.trim_matches(char::from(0)).trim().to_string();

        // クラス名を取得
        let mut class_buf = vec![0u16; 256];
        let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        let class_name = if class_len > 0 {
            let class_raw = String::from_utf16_lossy(&class_buf[..class_len as usize]);
            class_raw.trim_matches(char::from(0)).trim().to_string()
        } else {
            String::new()
        };

        // デバッグログ（調査用）: 可視かつタイトルが存在するウィンドウを出力
        println!(
            "[Rust/window] Found window: title='{}', class='{}'",
            title, class_name
        );

        let title_lower = title.to_lowercase();
        // タイトル部分一致かつクラス名部分一致で判定（ヌル文字などの影響を排除）
        if (title.contains("UmamusumePrettyDerby_Jpn")
            || title.contains("ウマ娘 プリティーダービー")
            || title_lower.contains("umamusume"))
            && class_name.contains("UnityWndClass")
        {
            state.found_hwnd = Some(hwnd);
            state.found_title = title;
            return 0; // 列挙を終了（ウィンドウ発見）
        }
    }

    1 // 列挙を続ける
}

/// タイトルに「ウマ娘」を含む可視ウィンドウを探索し、`GameWindow` を返す。
///
/// # エラー
/// - ウィンドウが見つからない場合: `CaptureError::WindowNotFound`
/// - クライアント領域の座標取得失敗: `CaptureError::CaptureFailed`
pub fn find_game_window() -> Result<GameWindow, CaptureError> {
    let mut state = SearchState {
        found_hwnd: None,
        found_title: String::new(),
    };

    unsafe {
        // Windowsの拡大率設定（125%など）による論理ピクセルと物理ピクセルのズレを解消
        SetProcessDPIAware();

        EnumWindows(
            Some(enum_windows_callback),
            &mut state as *mut SearchState as LPARAM,
        );
    }

    let hwnd = state.found_hwnd.ok_or(CaptureError::WindowNotFound)?;
    get_client_rect_in_screen_coords(hwnd, state.found_title)
}

/// HWND から `GetClientRect` + `ClientToScreen` を用いて
/// クライアント領域のスクリーン座標を計算する。
///
/// - `GetClientRect`: ウィンドウ枠・タイトルバーを除いた純粋なゲーム描画領域の矩形
/// - `ClientToScreen`: クライアント座標 (0, 0) をスクリーン座標に変換
fn get_client_rect_in_screen_coords(hwnd: HWND, title: String) -> Result<GameWindow, CaptureError> {
    // クライアント領域の矩形（クライアント座標系: 左上が (0,0)）
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    let ok = unsafe { GetClientRect(hwnd, &mut rect) };
    if ok == 0 {
        return Err(CaptureError::CaptureFailed(
            "GetClientRect の呼び出しに失敗しました".to_string(),
        ));
    }

    // クライアント座標の (0, 0) をスクリーン座標に変換
    let mut pt = POINT { x: 0, y: 0 };
    let ok = unsafe { ClientToScreen(hwnd, &mut pt) };
    if ok == 0 {
        return Err(CaptureError::CaptureFailed(
            "ClientToScreen の呼び出しに失敗しました".to_string(),
        ));
    }

    let client_width = (rect.right - rect.left) as u32;
    let client_height = (rect.bottom - rect.top) as u32;

    println!(
        "[Rust/window] Captured window: '{}' at (x={}, y={}, w={}, h={})",
        title, pt.x, pt.y, client_width, client_height
    );

    Ok(GameWindow {
        hwnd: hwnd as isize,
        title,
        client_x: pt.x,
        client_y: pt.y,
        client_width,
        client_height,
    })
}
