use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub container_binary: String,
    pub refresh_interval: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            container_binary: "/usr/local/bin/container".to_string(),
            refresh_interval: 5,
        }
    }
}

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub settings_path: Mutex<PathBuf>,
}

/// Single blocking helper — fully owned args so it's safe to move into spawn_blocking.
fn execute(binary: String, args: Vec<String>) -> Result<String, String> {
    let output = StdCommand::new(&binary)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run container CLI: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stderr.is_empty() { Err(stdout) } else { Err(stderr) }
    }
}

/// Runs `execute` on Tokio's dedicated blocking thread pool so the async
/// executor (and therefore the UI) is never stalled waiting for a CLI process.
async fn spawn(binary: String, args: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || execute(binary, args))
        .await
        .map_err(|e| e.to_string())?
}

/// Tokenize a command string respecting quoted arguments.
/// `sh -c "echo hello world"` → ["sh", "-c", "echo hello world"]
fn tokenize_command(cmd: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = '"';

    for ch in cmd.chars() {
        if in_quotes {
            if ch == quote_char { in_quotes = false; } else { current.push(ch); }
        } else if ch == '"' || ch == '\'' {
            in_quotes = true;
            quote_char = ch;
        } else if ch == ' ' || ch == '\t' {
            if !current.is_empty() { tokens.push(current.clone()); current.clear(); }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() { tokens.push(current); }
    tokens
}

// ─── Settings (no CLI call — stay sync) ─────────────────────────────────────

#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(state: State<AppState>, settings: Settings) -> Result<(), String> {
    let path = state.settings_path.lock().unwrap().clone();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

// ─── Version ─────────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_version(state: State<'_, AppState>) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["--version".into()]).await
}

// ─── Containers ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn list_containers(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["ls".into(), "-a".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_container_stats(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["stats".into(), "--format".into(), "json".into(), "--no-stream".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn inspect_container(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["inspect".into(), id]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_container(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["start".into(), id]).await
}

#[tauri::command]
async fn stop_container(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["stop".into(), id]).await
}

#[tauri::command]
async fn remove_container(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["rm".into(), id]).await
}

#[tauri::command]
async fn get_container_logs(state: State<'_, AppState>, id: String, boot: bool) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let args = if boot {
        vec!["logs".into(), "--boot".into(), id]
    } else {
        vec!["logs".into(), id]
    };
    spawn(bin, args).await
}

#[derive(Deserialize)]
pub struct RunContainerOptions {
    pub image: String,
    pub name: Option<String>,
    pub detach: bool,
    pub remove_on_stop: bool,
    pub ports: Vec<String>,
    pub volumes: Vec<String>,
    pub env_vars: Vec<String>,
    pub working_dir: Option<String>,
    pub command: Option<String>,
    pub network: Option<String>,
    pub cpus: Option<String>,
    pub memory: Option<String>,
}

#[tauri::command]
async fn run_container(state: State<'_, AppState>, options: RunContainerOptions) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let mut args: Vec<String> = vec!["run".into()];

    if options.detach { args.push("-d".into()); }
    if options.remove_on_stop { args.push("--rm".into()); }
    if let Some(name) = options.name { args.extend(["--name".into(), name]); }
    for port in options.ports { args.extend(["-p".into(), port]); }
    for vol in options.volumes { args.extend(["-v".into(), vol]); }
    for env in options.env_vars { args.extend(["-e".into(), env]); }
    if let Some(dir) = options.working_dir { args.extend(["-w".into(), dir]); }
    if let Some(cpus) = options.cpus { args.extend(["--cpus".into(), cpus]); }
    if let Some(mem) = options.memory { args.extend(["--memory".into(), mem]); }
    if let Some(net) = options.network { args.extend(["--network".into(), net]); }
    args.push(options.image);
    if let Some(cmd) = options.command { args.extend(tokenize_command(&cmd)); }

    spawn(bin, args).await
}

// ─── Images ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn list_images(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["image".into(), "list".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_image(state: State<'_, AppState>, reference: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["image".into(), "delete".into(), reference]).await
}

#[tauri::command]
async fn pull_image(state: State<'_, AppState>, reference: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["image".into(), "pull".into(), reference, "--progress".into(), "none".into()]).await
}

#[tauri::command]
async fn inspect_image(state: State<'_, AppState>, reference: String) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["image".into(), "inspect".into(), reference]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

// ─── Networks ─────────────────────────────────────────────────────────────────

#[tauri::command]
async fn list_networks(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["network".into(), "ls".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_network(state: State<'_, AppState>, name: String, subnet: Option<String>) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let mut args = vec!["network".into(), "create".into()];
    if let Some(s) = subnet { args.extend(["--subnet".into(), s]); }
    args.push(name);
    spawn(bin, args).await
}

#[tauri::command]
async fn delete_network(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["network".into(), "rm".into(), id]).await
}

// ─── DNS ──────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn list_dns(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["system".into(), "dns".into(), "ls".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

// ─── System ───────────────────────────────────────────────────────────────────

#[tauri::command]
async fn system_df(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["system".into(), "df".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_system_properties(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["system".into(), "property".into(), "list".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_system_property(state: State<'_, AppState>, id: String, value: String) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["system".into(), "property".into(), "set".into(), id, value]).await
}

#[tauri::command]
async fn system_start(state: State<'_, AppState>) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["system".into(), "start".into()]).await
}

#[tauri::command]
async fn system_stop(state: State<'_, AppState>) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["system".into(), "stop".into()]).await
}

#[tauri::command]
async fn system_restart(state: State<'_, AppState>) -> Result<String, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    spawn(bin, vec!["system".into(), "restart".into()]).await
}

#[tauri::command]
async fn builder_status(state: State<'_, AppState>) -> Result<Value, String> {
    let bin = state.settings.lock().unwrap().container_binary.clone();
    let out = spawn(bin, vec!["builder".into(), "status".into(), "--format".into(), "json".into()]).await?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

// ─── Shell access ─────────────────────────────────────────────────────────────

/// Single-quote a string for POSIX sh, escaping any embedded single quotes.
/// e.g.  my-web-server  →  'my-web-server'
///       it's           →  'it'"'"'s'
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\"'\"'"))
}

/// Writes a temp .command file and opens it with Terminal.app.
/// The container ID and binary path are shell-quoted into the script body —
/// they are never concatenated into an AppleScript string.
#[tauri::command]
async fn open_shell(state: State<'_, AppState>, id: String, shell: String) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let bin = state.settings.lock().unwrap().container_binary.clone();

    // Build a self-contained script; all runtime values are shell-quoted.
    let script = format!(
        "#!/bin/sh\nclear\nexec {} exec --tty --interactive {} {}\n",
        shell_quote(&bin),
        shell_quote(&id),
        shell_quote(&shell),
    );

    // .command extension makes Terminal.app treat the file as a runnable script.
    let tmp = std::env::temp_dir().join(format!("yana-shell-{}.command", &id));

    std::fs::write(&tmp, &script).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o700))
        .map_err(|e| e.to_string())?;

    // Pass the file path as a typed arg to `open` — no shell interpolation.
    tauri::async_runtime::spawn_blocking(move || {
        StdCommand::new("open")
            .args(["-a", "Terminal", tmp.to_str().unwrap_or("")])
            .output()
            .map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            std::fs::create_dir_all(&data_dir).ok();
            let settings_path = data_dir.join("settings.json");

            let loaded_settings: Settings = if settings_path.exists() {
                std::fs::read_to_string(&settings_path)
                    .ok()
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default()
            } else {
                Settings::default()
            };

            app.manage(AppState {
                settings: Mutex::new(loaded_settings),
                settings_path: Mutex::new(settings_path),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_version,
            list_containers,
            get_container_stats,
            inspect_container,
            start_container,
            stop_container,
            remove_container,
            get_container_logs,
            run_container,
            list_images,
            delete_image,
            pull_image,
            inspect_image,
            list_networks,
            create_network,
            delete_network,
            list_dns,
            system_df,
            list_system_properties,
            set_system_property,
            system_start,
            system_stop,
            system_restart,
            builder_status,
            open_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
