// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod project;

use project::ClientProject;

/// `root` vem das configuracoes do app. Fica opcional para nao quebrar quem
/// ja usava a variavel de ambiente SPIDER_PROJECTS_ROOT.
#[tauri::command]
fn list_projects(root: Option<String>) -> Result<Vec<ClientProject>, String> {
    project::list(root)
}

#[tauri::command]
fn open_in_orca(project_id: String, path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    commands::orca::open_project(&path)
        .map_err(|e| format!("falha ao abrir \"{project_id}\" no Orca: {e}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_projects, open_in_orca])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Spider");
}
