use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

const AI_PET_DIR_NAME: &str = ".ai-pet";
const ENV_FILE_NAME: &str = ".env";
const PETS_DIR_NAME: &str = "pets";

const DEFAULT_ENV: &str = "\
# AI Pet user configuration
# Keys are loaded as environment-style variables.

# PET                    Default pet id (loaded from ~/.ai-pet/pets/<id>, fallback public/default)
PET=sugarwing

# AI_PET_ANIMATION_TICK  Frame interval in milliseconds for all animations
AI_PET_ANIMATION_TICK=250

# AI_PET_THEME            Theme: auto | light | dark (auto follows system)
AI_PET_THEME=auto

# AI_PET_DEBUG_PROTOCOL   Log received aipet:// URLs to devtools (true | 1)
# AI_PET_DEBUG_PROTOCOL=false

# AI_PET_WINDOW_RIGHT     Screen X of window top-right corner (saved after drag)
# AI_PET_WINDOW_TOP       Screen Y of window top edge (saved after drag)
";

pub fn ai_pet_dir(home: &Path) -> PathBuf {
    home.join(AI_PET_DIR_NAME)
}

pub fn env_file_path(home: &Path) -> PathBuf {
    ai_pet_dir(home).join(ENV_FILE_NAME)
}

pub fn pets_dir(home: &Path) -> PathBuf {
    ai_pet_dir(home).join(PETS_DIR_NAME)
}

pub fn ensure_ai_pet_dir(home: &Path) -> Result<(), String> {
    fs::create_dir_all(ai_pet_dir(home)).map_err(|error| error.to_string())?;
    fs::create_dir_all(pets_dir(home)).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn ensure_env_file(home: &Path) -> Result<PathBuf, String> {
    ensure_ai_pet_dir(home)?;
    let path = env_file_path(home);
    if !path.exists() {
        fs::write(&path, DEFAULT_ENV).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

pub fn load_env_file(home: &Path) -> Result<HashMap<String, String>, String> {
    let path = ensure_env_file(home)?;
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    Ok(parse_env_content(&content))
}

pub fn parse_env_content(content: &str) -> HashMap<String, String> {
    let mut env = HashMap::new();

    for line in content.lines() {
        let mut line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Strip UTF-8 BOM on first line.
        line = line.trim_start_matches('\u{feff}');

        let Some((key, value)) = line.split_once('=') else {
            continue;
        };

        let mut key = key.trim().to_string();
        if key.starts_with("export ") {
            key = key["export ".len()..].trim().to_string();
        }
        if key.is_empty() {
            continue;
        }

        env.insert(key, unquote(value.trim()));
    }

    env
}

/// True for `1`, `true`, `yes`, `on` (case-insensitive).
pub fn is_env_truthy(value: Option<&String>) -> bool {
    value
        .map(|raw| {
            let v = raw.trim().to_lowercase();
            v == "1" || v == "true" || v == "yes" || v == "on"
        })
        .unwrap_or(false)
}

pub fn protocol_debug_enabled(env: &HashMap<String, String>) -> bool {
    is_env_truthy(env.get("AI_PET_DEBUG_PROTOCOL"))
}

/// Merge `updates` into `~/.ai-pet/.env`, replacing existing keys or appending new ones.
pub fn merge_env_file(home: &Path, updates: &HashMap<String, String>) -> Result<(), String> {
    ensure_env_file(home)?;
    let path = env_file_path(home);
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let mut lines: Vec<String> = if content.is_empty() {
        Vec::new()
    } else {
        content.lines().map(String::from).collect()
    };
    let mut touched = HashSet::new();

    for line in lines.iter_mut() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let line_body = trimmed.trim_start_matches('\u{feff}');
        let Some((key, _)) = line_body.split_once('=') else {
            continue;
        };

        let mut key = key.trim().to_string();
        if key.starts_with("export ") {
            key = key["export ".len()..].trim().to_string();
        }
        if let Some(value) = updates.get(&key) {
            *line = format!("{key}={value}");
            touched.insert(key);
        }
    }

    for (key, value) in updates {
        if !touched.contains(key) {
            lines.push(format!("{key}={value}"));
        }
    }

    let mut output = lines.join("\n");
    if !output.ends_with('\n') {
        output.push('\n');
    }
    fs::write(&path, output).map_err(|error| error.to_string())
}

fn unquote(value: &str) -> String {
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        if (bytes[0] == b'"' && bytes[value.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[value.len() - 1] == b'\'')
        {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::fs;
    use std::path::{Path, PathBuf};

    use super::{
        env_file_path, is_env_truthy, merge_env_file, parse_env_content, pets_dir,
        protocol_debug_enabled,
    };

    #[test]
    fn parses_comments_and_values() {
        let env = parse_env_content(
            "# comment\nPET=sugarwing\nEMPTY=\nQUOTED=\"hello world\"\n",
        );
        assert_eq!(env.get("PET"), Some(&"sugarwing".to_string()));
        assert_eq!(env.get("EMPTY"), Some(&"".to_string()));
        assert_eq!(env.get("QUOTED"), Some(&"hello world".to_string()));
    }

    #[test]
    fn parses_protocol_debug_flag() {
        let env = parse_env_content("AI_PET_DEBUG_PROTOCOL=true\n");
        assert!(protocol_debug_enabled(&env));
        assert!(is_env_truthy(env.get("AI_PET_DEBUG_PROTOCOL")));
    }

    #[test]
    fn merge_env_file_updates_existing_key() {
        let dir = std::env::temp_dir().join(format!("ai-pet-env-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let ai_pet_dir = dir.join(".ai-pet");
        fs::create_dir_all(&ai_pet_dir).unwrap();
        fs::write(
            ai_pet_dir.join(".env"),
            "# comment\nPET=sugarwing\nAI_PET_WINDOW_TOP=10\n",
        )
        .unwrap();

        let mut updates = HashMap::new();
        updates.insert("AI_PET_WINDOW_TOP".to_string(), "200".to_string());
        merge_env_file(dir.as_path(), &updates).unwrap();

        let env = parse_env_content(&fs::read_to_string(ai_pet_dir.join(".env")).unwrap());
        assert_eq!(env.get("AI_PET_WINDOW_TOP"), Some(&"200".to_string()));
        assert_eq!(env.get("PET"), Some(&"sugarwing".to_string()));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolves_config_paths_under_ai_pet_dir() {
        let home = Path::new("/tmp/example-home");
        assert_eq!(
            env_file_path(home),
            PathBuf::from("/tmp/example-home/.ai-pet/.env")
        );
        assert_eq!(
            pets_dir(home),
            PathBuf::from("/tmp/example-home/.ai-pet/pets")
        );
    }
}
