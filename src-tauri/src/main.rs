// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod project;

use project::ClientProject;

#[tauri::command]
fn list_projects() -> Result<Vec<ClientProject>, String> {
    project::list()
}

#[tauri::command]
fn open_in_orca(project_id: String, path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    commands::orca::open_project(&path)
        .map_err(|e| format!("falha ao abrir \"{project_id}\" no Orca: {e}"))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_projects, open_in_orca])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Spider");
}
