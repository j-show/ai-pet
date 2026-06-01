use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::user_env;

#[derive(Debug, Deserialize, Serialize)]
pub struct TextPayload {
    pub title: Option<String>,
    pub text: Option<String>,
}

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

pub fn read_text_payload(home: &Path, sid: &str) -> Result<Option<TextPayload>, String> {
    let path = user_env::ai_pet_dir(home)
        .join("messages")
        .join(format!("{}.json", sanitize_sid(sid)));

    if !path.is_file() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map(Some).map_err(|error| error.to_string())
}
