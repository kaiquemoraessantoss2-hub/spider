use crate::commands::git::{self, GitStatus};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone, Debug)]
pub struct ClientProject {
    pub id: String,
    pub display_name: String,
    pub path: String,
    pub brand: Option<String>,
    pub git: GitStatus,
    // Hosting (Coolify) and billing (Asaas) collectors aren't wired up yet —
    // always null for now. The frontend already renders a
    // "não configurado" state for both, so this is additive later, not a
    // breaking change to the TS side.
    pub hosting: Option<serde_json::Value>,
    pub billing: Option<serde_json::Value>,
}

/// Optional per-folder override, e.g. `wcj-instalacoes/.spider.json`:
/// `{ "display_name": "WCJ Instalações", "brand": "koder" }`
/// Lets a folder slug like `wcj-instalacoes` map to a proper client name
/// without Spider guessing at string formatting.
#[derive(Deserialize, Default)]
struct ProjectOverride {
    display_name: Option<String>,
    brand: Option<String>,
}

fn projects_root() -> Result<PathBuf, String> {
    env::var("SPIDER_PROJECTS_ROOT")
        .map(PathBuf::from)
        .map_err(|_| {
            "defina a variável de ambiente SPIDER_PROJECTS_ROOT apontando para a pasta \
             que contém as pastas de cada cliente"
                .to_string()
        })
}

fn folder_name_to_display(name: &str) -> String {
    name.replace(['-', '_'], " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn read_override(dir: &Path) -> ProjectOverride {
    let path = dir.join(".spider.json");
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

pub fn list() -> Result<Vec<ClientProject>, String> {
    let root = projects_root()?;

    let entries = fs::read_dir(&root)
        .map_err(|e| format!("não consegui ler {}: {e}", root.display()))?;

    let mut projects = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        // Skip dotfiles/dotdirs (.git, .DS_Store, etc.) at the root level.
        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) if !name.starts_with('.') => name.to_string(),
            _ => continue,
        };

        let overrides = read_override(&path);
        let git_status = git::collect(&path);

        projects.push(ClientProject {
            id: folder_name.clone(),
            display_name: overrides
                .display_name
                .unwrap_or_else(|| folder_name_to_display(&folder_name)),
            path: path.to_string_lossy().to_string(),
            brand: overrides.brand,
            git: git_status,
            hosting: None,
            billing: None,
        });
    }

    projects.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    Ok(projects)
}
