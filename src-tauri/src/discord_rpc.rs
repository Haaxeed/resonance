use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::Duration;

const DISCORD_CLIENT_ID: &str = "1516168278257696889";

enum RpcCommand {
    Update(Option<String>),
    Stop,
}

static RPC_TX: Mutex<Option<Sender<RpcCommand>>> = Mutex::new(None);

fn default_activity() -> activity::Activity<'static> {
    activity::Activity::new()
        .details("Resonance Soundboard")
        .state("Prêt à envoyer du son")
        .assets(
            activity::Assets::new()
                .large_image("icon")
                .large_text("Resonance Soundboard"),
        )
}

fn playing_activity(details: &str) -> activity::Activity<'_> {
    activity::Activity::new()
        .details(details)
        .state("Dans le board")
        .assets(
            activity::Assets::new()
                .large_image("icon")
                .large_text("Resonance Soundboard"),
        )
}

pub fn init(enabled: bool) {
    if !enabled {
        return;
    }

    if DISCORD_CLIENT_ID == "[REDACTED]" {
        eprintln!("[Resonance] Discord RPC: DISCORD_CLIENT_ID n'est pas configuré. Rich Presence désactivée.");
        return;
    }

    let mut guard = RPC_TX.lock().unwrap();
    if guard.is_some() {
        return;
    }

    let (tx, rx) = channel::<RpcCommand>();
    *guard = Some(tx);
    drop(guard);

    std::thread::spawn(move || {
        let mut client = loop {
            match DiscordIpcClient::new(DISCORD_CLIENT_ID) {
                Ok(c) => break c,
                Err(e) => {
                    eprintln!("[Resonance] Discord RPC client creation failed (retry in 5s): {}", e);
                    std::thread::sleep(Duration::from_secs(5));
                }
            }
        };

        loop {
            if let Err(e) = client.connect() {
                eprintln!("[Resonance] Discord RPC connect failed (retry in 5s): {}", e);
                std::thread::sleep(Duration::from_secs(5));
                continue;
            }
            break;
        }

        eprintln!("[Resonance] Discord RPC connectée.");
        let _ = client.set_activity(default_activity());

        loop {
            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(RpcCommand::Update(Some(name))) => {
                    let details = format!("Joue : {}", name);
                    let _ = client.set_activity(playing_activity(&details));
                }
                Ok(RpcCommand::Update(None)) => {
                    let _ = client.set_activity(default_activity());
                }
                Ok(RpcCommand::Stop) => {
                    let _ = client.clear_activity();
                    let _ = client.close();
                    break;
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });
}

pub fn set_enabled(enabled: bool) {
    if enabled {
        init(true);
    } else {
        stop();
    }
}

pub fn stop() {
    let mut guard = RPC_TX.lock().unwrap();
    if let Some(tx) = guard.take() {
        let _ = tx.send(RpcCommand::Stop);
    }
}

pub fn update_activity(sound_name: Option<&str>) {
    let guard = RPC_TX.lock().unwrap();
    if let Some(tx) = guard.as_ref() {
        let _ = tx.send(RpcCommand::Update(sound_name.map(|s| s.to_string())));
    }
}
