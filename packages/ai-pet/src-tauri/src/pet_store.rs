use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::user_env;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedUserPet {
    pub manifest: Value,
    pub spritesheet_path: String,
}

pub fn validate_pet_id(pet_id: &str) -> Result<(), String> {
    if pet_id.is_empty() {
        return Err("Pet id cannot be empty".into());
    }

    if pet_id.contains("..") || pet_id.contains('/') || pet_id.contains('\\') {
        return Err(format!("Invalid pet id: {pet_id}"));
    }

    if !pet_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        return Err(format!("Invalid pet id: {pet_id}"));
    }

    Ok(())
}

pub fn user_pet_dir(home: &Path, pet_id: &str) -> Result<PathBuf, String> {
    validate_pet_id(pet_id)?;
    Ok(user_env::pets_dir(home).join(pet_id))
}

pub fn resolve_user_pet(home: &Path, pet_id: &str) -> Result<Option<ResolvedUserPet>, String> {
    user_env::ensure_ai_pet_dir(home)?;

    let pet_dir = user_pet_dir(home, pet_id)?;
    let manifest_path = pet_dir.join("pet.json");
    if !manifest_path.is_file() {
        return Ok(None);
    }

    let manifest_raw = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
    let manifest: Value =
        serde_json::from_str(&manifest_raw).map_err(|error| error.to_string())?;

    let spritesheet_rel = manifest
        .get("spritesheetPath")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Missing spritesheetPath in {}", manifest_path.display()))?;

    if spritesheet_rel.contains("..") {
        return Err(format!("Invalid spritesheetPath for pet \"{pet_id}\""));
    }

    let spritesheet_path = pet_dir.join(spritesheet_rel);
    if !spritesheet_path.is_file() {
        return Err(format!(
            "Spritesheet not found for pet \"{pet_id}\": {}",
            spritesheet_path.display()
        ));
    }

    let pet_dir_canonical = pet_dir
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let spritesheet_canonical = spritesheet_path
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !spritesheet_canonical.starts_with(&pet_dir_canonical) {
        return Err(format!("Invalid spritesheetPath for pet \"{pet_id}\""));
    }

    Ok(Some(ResolvedUserPet {
        manifest,
        spritesheet_path: spritesheet_path.to_string_lossy().into_owned(),
    }))
}

#[cfg(test)]
mod tests {
    use super::validate_pet_id;

    #[test]
    fn rejects_path_traversal_pet_ids() {
        assert!(validate_pet_id("sugarwing").is_ok());
        assert!(validate_pet_id("../etc").is_err());
        assert!(validate_pet_id("bad/id").is_err());
    }
}
