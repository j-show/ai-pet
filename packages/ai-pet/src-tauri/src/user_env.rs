use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

const AI_PET_DIR_NAME: &str = ".ai-pet";
const ENV_FILE_NAME: &str = ".env";
const PETS_DIR_NAME: &str = "pets";

const DEFAULT_ENV: &str = "\
# AI Pet user configuration
# Keys are loaded as environment-style variables.
#
# PET                    Default pet id (loaded from ~/.ai-pet/pets/<id>, fallback public/default)
PET=sugarwing
# AI_PET_ANIMATION_TICK  Frame interval in milliseconds for all animations
AI_PET_ANIMATION_TICK=250
# AI_PET_THEME            Theme: auto | light | dark (auto follows system)
AI_PET_THEME=auto
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
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let Some((key, value)) = line.split_once('=') else {
            continue;
        };

        let key = key.trim();
        if key.is_empty() {
            continue;
        }

        env.insert(key.to_string(), unquote(value.trim()));
    }

    env
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
    use std::path::{Path, PathBuf};

    use super::{env_file_path, parse_env_content, pets_dir};

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
