use std::sync::{Arc, Mutex};
use std::thread;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::*;
use windows::Win32::UI::WindowsAndMessaging::*;

pub struct InputHookState {
    hook: Option<HHOOK>,
    bindings: Vec<(String, String)>,
    callback: Option<Arc<dyn Fn(&str) + Send + Sync + 'static>>,
}

impl InputHookState {
    fn new() -> Self {
        Self {
            hook: None,
            bindings: Vec::new(),
            callback: None,
        }
    }
}

pub struct InputHookManager {
    pub inner: Arc<Mutex<InputHookState>>,
}

impl InputHookManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(InputHookState::new())),
        }
    }

    pub fn set_bindings(&self, bindings: Vec<(String, String)>) {
        if let Ok(mut state) = self.inner.lock() {
            state.bindings = bindings;
        }
    }

    pub fn start<F>(&self, callback: F)
    where
        F: Fn(&str) + Send + Sync + 'static,
    {
        let inner = self.inner.clone();
        {
            let mut state = inner.lock().expect("lock input hook state");
            state.callback = Some(Arc::new(callback));
        }

        thread::spawn(move || unsafe {
            let hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                HINSTANCE::default(),
                0,
            );

            if hook.is_err() {
                println!("[Resonance] failed to set low-level keyboard hook");
                return;
            }

            let hook = hook.unwrap();
            {
                let mut state = inner.lock().expect("lock input hook state");
                state.hook = Some(hook);
            }

            println!("[Resonance] low-level keyboard hook installed");

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            let _ = UnhookWindowsHookEx(hook);
        });
    }
}

unsafe extern "system" fn low_level_keyboard_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let msg = w_param.0 as u32;
    if msg != WM_KEYDOWN && msg != WM_SYSKEYDOWN {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let info = *(l_param.0 as *const KBDLLHOOKSTRUCT);
    let vk = info.vkCode;

    // Ignore injected events to avoid feedback loops
    if (info.flags.0 & LLKHF_INJECTED.0) != 0 {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let key_name = vk_to_name(vk);
    if key_name.is_none() {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let mut parts = Vec::new();
    if is_pressed(VK_LCONTROL) || is_pressed(VK_RCONTROL) {
        parts.push("CmdOrControl".to_string());
    }
    if is_pressed(VK_LSHIFT) || is_pressed(VK_RSHIFT) {
        parts.push("Shift".to_string());
    }
    if is_pressed(VK_LMENU) || is_pressed(VK_RMENU) {
        parts.push("Alt".to_string());
    }
    if is_pressed(VK_LWIN) || is_pressed(VK_RWIN) {
        parts.push("Meta".to_string());
    }
    parts.push(key_name.unwrap());

    let shortcut = parts.join("+");

    // Global state is injected via thread-local-ish access through a static.
    // Tauri apps are single-process, this is acceptable for a soundboard.
    if let Some(inner) = INPUT_HOOK_STATE.as_ref() {
        if let Ok(state) = inner.lock() {
            for (binding_shortcut, sound_id) in &state.bindings {
                if shortcuts_match(binding_shortcut, &shortcut) {
                    if let Some(cb) = &state.callback {
                        cb(sound_id);
                    }
                    return LRESULT(1);
                }
            }
        }
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

fn is_pressed(vk: VIRTUAL_KEY) -> bool {
    unsafe { (GetAsyncKeyState(vk.0 as i32) as u16 & 0x8000) != 0 }
}

fn shortcuts_match(a: &str, b: &str) -> bool {
    let normalize = |s: &str| {
        let mut parts: Vec<String> = s
            .split('+')
            .map(|p| p.trim().to_ascii_lowercase())
            .filter(|p| !p.is_empty())
            .map(|p| match p.as_str() {
                "ctrl" | "control" | "cmdorcontrol" | "commandorcontrol" => "cmdorcontrol".to_string(),
                "alt" | "option" => "alt".to_string(),
                "shift" => "shift".to_string(),
                "meta" | "cmd" | "command" | "super" | "win" | "windows" => "meta".to_string(),
                "esc" => "escape".to_string(),
                "del" => "delete".to_string(),
                "return" => "enter".to_string(),
                "spacebar" => "space".to_string(),
                "num0" | "numpad0" => "num0".to_string(),
                "num1" | "numpad1" => "num1".to_string(),
                "num2" | "numpad2" => "num2".to_string(),
                "num3" | "numpad3" => "num3".to_string(),
                "num4" | "numpad4" => "num4".to_string(),
                "num5" | "numpad5" => "num5".to_string(),
                "num6" | "numpad6" => "num6".to_string(),
                "num7" | "numpad7" => "num7".to_string(),
                "num8" | "numpad8" => "num8".to_string(),
                "num9" | "numpad9" => "num9".to_string(),
                "numadd" | "numpadadd" | "numplus" | "numpadplus" => "numadd".to_string(),
                "numsubtract" | "numpadsubtract" | "numminus" | "numpadminus" => "numsubtract".to_string(),
                "nummultiply" | "numpadmultiply" => "nummultiply".to_string(),
                "numdivide" | "numpaddivide" => "numdivide".to_string(),
                "numdecimal" | "numpaddecimal" => "numdecimal".to_string(),
                "numenter" | "numpadenter" => "numenter".to_string(),
                _ => p,
            })
            .collect();
        parts.sort();
        parts
    };
    normalize(a) == normalize(b)
}

fn vk_to_name(vk: u32) -> Option<String> {
    let key = if vk >= VK_A.0 as u32 && vk <= VK_Z.0 as u32 {
        ((vk - VK_A.0 as u32 + b'A' as u32) as u8 as char).to_string()
    } else if vk >= VK_0.0 as u32 && vk <= VK_9.0 as u32 {
        ((vk - VK_0.0 as u32 + b'0' as u32) as u8 as char).to_string()
    } else if vk >= VK_NUMPAD0.0 as u32 && vk <= VK_NUMPAD9.0 as u32 {
        format!("Num{}", vk - VK_NUMPAD0.0 as u32)
    } else if vk >= VK_F1.0 as u32 && vk <= VK_F24.0 as u32 {
        format!("F{}", vk - VK_F1.0 as u32 + 1)
    } else {
        match VIRTUAL_KEY(vk as u16) {
            VK_SPACE => "Space".to_string(),
            VK_RETURN => "Enter".to_string(),
            VK_ESCAPE => "Escape".to_string(),
            VK_TAB => "Tab".to_string(),
            VK_BACK => "Backspace".to_string(),
            VK_DELETE => "Delete".to_string(),
            VK_INSERT => "Insert".to_string(),
            VK_HOME => "Home".to_string(),
            VK_END => "End".to_string(),
            VK_PRIOR => "PageUp".to_string(),
            VK_NEXT => "PageDown".to_string(),
            VK_LEFT => "Left".to_string(),
            VK_RIGHT => "Right".to_string(),
            VK_UP => "Up".to_string(),
            VK_DOWN => "Down".to_string(),
            VK_VOLUME_UP => "VolumeUp".to_string(),
            VK_VOLUME_DOWN => "VolumeDown".to_string(),
            VK_VOLUME_MUTE => "VolumeMute".to_string(),
            VK_MEDIA_PLAY_PAUSE => "MediaPlayPause".to_string(),
            VK_MEDIA_STOP => "MediaStop".to_string(),
            VK_MEDIA_NEXT_TRACK => "MediaNextTrack".to_string(),
            VK_MEDIA_PREV_TRACK => "MediaPrevTrack".to_string(),
            VK_ADD => "NumAdd".to_string(),
            VK_SUBTRACT => "NumSubtract".to_string(),
            VK_MULTIPLY => "NumMultiply".to_string(),
            VK_DIVIDE => "NumDivide".to_string(),
            VK_DECIMAL => "NumDecimal".to_string(),
            VK_PAUSE => "Pause".to_string(),
            VK_SNAPSHOT => "PrintScreen".to_string(),
            VK_SCROLL => "ScrollLock".to_string(),
            VK_OEM_1 => "Semicolon".to_string(),
            VK_OEM_2 => "Slash".to_string(),
            VK_OEM_3 => "Backquote".to_string(),
            VK_OEM_4 => "BracketLeft".to_string(),
            VK_OEM_5 => "Backslash".to_string(),
            VK_OEM_6 => "BracketRight".to_string(),
            VK_OEM_7 => "Quote".to_string(),
            VK_OEM_COMMA => "Comma".to_string(),
            VK_OEM_PERIOD => "Period".to_string(),
            VK_OEM_PLUS => "Equal".to_string(),
            VK_OEM_MINUS => "Minus".to_string(),
            _ => return None,
        }
    };
    Some(key)
}

static mut INPUT_HOOK_STATE: Option<Arc<Mutex<InputHookState>>> = None;

pub unsafe fn set_global_input_hook(manager: &InputHookManager) {
    INPUT_HOOK_STATE = Some(manager.inner.clone());
}
