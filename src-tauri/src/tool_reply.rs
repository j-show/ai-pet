use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Deserialize;

use crate::user_env;

const SESSION_TYPES: &[&str] = &["claude", "codex", "cursor", "qcode"];

fn sanitize_sid(sid: &str) -> String {
    let safe: String = sid
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = safe.chars().take(120).collect::<String>();
    if trimmed.is_empty() {
        "default".to_string()
    } else {
        trimmed
    }
}

fn validate_sty(sty: &str) -> Result<&'static str, String> {
    let value = sty.trim().to_lowercase();
    match value.as_str() {
        "claude" => Ok("claude"),
        "codex" => Ok("codex"),
        "cursor" => Ok("cursor"),
        "qcode" => Ok("qcode"),
        _ => Err(format!(
            "unsupported sty: {sty} (expected one of {})",
            SESSION_TYPES.join(", ")
        )),
    }
}

#[derive(Debug, Deserialize)]
struct PluginState {
    #[serde(default, alias = "projectCwd")]
    project_cwd: Option<String>,
}

fn read_project_cwd(home: &Path) -> Option<String> {
    let path = user_env::ai_pet_dir(home).join("plugin-state.json");
    if !path.is_file() {
        return None;
    }

    let raw = fs::read_to_string(&path).ok()?;
    let state: PluginState = serde_json::from_str(&raw).ok()?;
    state
        .project_cwd
        .map(|cwd| cwd.trim().to_string())
        .filter(|cwd| !cwd.is_empty())
}

fn write_reply_inbox(home: &Path, sty: &str, sid: &str, text: &str) -> Result<PathBuf, String> {
    let dir = user_env::ai_pet_dir(home).join("replies").join("inbox");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let file_name = format!(
        "{}-{}-{}.json",
        sty,
        sanitize_sid(sid),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    );
    let path = dir.join(&file_name);
    let payload = serde_json::json!({
        "sty": sty,
        "sid": sid,
        "text": text,
        "createdAt": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    });

    fs::write(
        &path,
        serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    Ok(path)
}

fn spawn_detached(mut command: Command) -> Result<(), String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn spawn_claude(sid: &str, text: &str, cwd: Option<&str>) -> Result<(), String> {
    let mut command = Command::new("claude");
    command.args([
        "--resume",
        sid,
        "--print",
        "--permission-mode",
        "dontAsk",
        text,
    ]);
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    spawn_detached(command)
}

fn spawn_codex(sid: &str, text: &str, cwd: Option<&str>) -> Result<(), String> {
    let mut command = Command::new("codex");
    command.arg("resume").arg(sid).arg(text);
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    spawn_detached(command)
}

fn spawn_cursor(sid: &str, text: &str, cwd: Option<&str>) -> Result<(), String> {
    let mut command = Command::new("cursor");
    command.args([
        "agent",
        "--resume",
        sid,
        "--print",
        "--trust",
        text,
    ]);
    if let Some(dir) = cwd {
        command.arg("--workspace").arg(dir);
    }
    spawn_detached(command)
}

fn spawn_qcode_from_env(
    home: &Path,
    sid: &str,
    inbox_path: &Path,
    cwd: Option<&str>,
) -> Result<(), String> {
    let env = user_env::load_env_file(home).unwrap_or_default();
    let template = env
        .get("AI_PET_REPLY_QCODE_CMD")
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "qcode reply: set AI_PET_REPLY_QCODE_CMD in ~/.ai-pet/.env (inbox file is still written)"
                .to_string()
        })?;

    let inbox = inbox_path.display().to_string();
    let command_line = template
        .replace("{sid}", sid)
        .replace("{inbox}", &inbox)
        .replace("{text_file}", &inbox);

    let mut command = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &command_line]);
        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", &command_line]);
        cmd
    };

    if let Some(dir) = cwd {
        command.current_dir(dir);
    }

    spawn_detached(command)
}

pub fn send_tool_reply(home: &Path, sty: &str, sid: &str, text: &str) -> Result<(), String> {
    let sty = validate_sty(sty)?;
    let sid = sid.trim();
    if sid.is_empty() {
        return Err("sid is required".to_string());
    }

    let text = text.trim();
    if text.is_empty() {
        return Err("reply text is required".to_string());
    }

    let inbox_path = write_reply_inbox(home, sty, sid, text)?;
    let cwd = read_project_cwd(home);

    match sty {
        "claude" => spawn_claude(sid, text, cwd.as_deref()),
        "codex" => spawn_codex(sid, text, cwd.as_deref()),
        "cursor" => spawn_cursor(sid, text, cwd.as_deref()),
        "qcode" => {
            if let Ok(()) = spawn_qcode_from_env(home, sid, &inbox_path, cwd.as_deref()) {
                return Ok(());
            }
            Ok(())
        }
        _ => unreachable!(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_sty_accepts_known_tools() {
        assert_eq!(validate_sty("cursor").unwrap(), "cursor");
        assert_eq!(validate_sty("QCODE").unwrap(), "qcode");
    }

    #[test]
    fn validate_sty_rejects_unknown() {
        assert!(validate_sty("vscode").is_err());
    }

    #[test]
    fn send_tool_reply_requires_sid_and_text() {
        let home = std::env::temp_dir().join(format!("ai-pet-reply-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        fs::create_dir_all(&home).unwrap();

        assert!(send_tool_reply(&home, "cursor", "", "hello").is_err());
        assert!(send_tool_reply(&home, "cursor", "sid-1", "   ").is_err());

        let _ = fs::remove_dir_all(&home);
    }
}
