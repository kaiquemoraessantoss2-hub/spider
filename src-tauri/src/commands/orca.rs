use std::path::Path;
use std::process::Command;

/// Hands a project off to the Orca ADE (https://www.onorca.dev) instead of
/// Spider reimplementing PTY/worktree handling. Orca must already be
/// installed and its `orca` binary on PATH.
///
/// IMPORTANT: `worktree create --path` below is written from the public
/// docs/reviews available at the time this was written, not a verified
/// `orca --help` dump — I could not fetch the full CLI reference. Run
/// `orca --help` and `orca worktree --help` on your machine and adjust the
/// args here if they don't match before relying on this.
pub fn open_project(path: &Path) -> Result<(), String> {
    let status = Command::new("orca")
        .arg("worktree")
        .arg("create")
        .arg("--path")
        .arg(path)
        .status()
        .map_err(|e| format!("não encontrei o binário `orca` no PATH: {e}"))?;

    if !status.success() {
        return Err(format!("orca worktree create saiu com código {status}"));
    }

    Ok(())
}
