use serde::Serialize;
use std::path::Path;
use std::process::Command;

/// Mirrors `GitStatus` in src/types/project.ts. Keep both in sync by hand.
#[derive(Serialize, Clone, Debug)]
pub struct GitStatus {
    pub branch: String,
    pub dirty_files: u32,
    pub unpushed_commits: u32,
    pub last_commit_at: Option<String>,
    pub last_commit_message: Option<String>,
    pub error: Option<String>,
}

impl GitStatus {
    fn error(message: impl Into<String>) -> Self {
        GitStatus {
            branch: String::new(),
            dirty_files: 0,
            unpushed_commits: 0,
            last_commit_at: None,
            last_commit_message: None,
            error: Some(message.into()),
        }
    }
}

/// Runs `git <args>` in `dir` and returns trimmed stdout, or None on any
/// non-zero exit / missing binary. We deliberately swallow errors here —
/// the caller decides what a missing piece of git state means for the UI
/// (e.g. "no upstream configured" isn't the same failure as "not a repo").
fn run_git(dir: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git").args(args).current_dir(dir).output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Collects branch, dirty-file count, unpushed-commit count, and last
/// commit metadata for a single project folder. Never panics: any git
/// failure (not a repo, no commits yet, no upstream) is reported through
/// `GitStatus.error` or falls back to a zero/None value rather than
/// crashing the whole dashboard fetch over one bad folder.
pub fn collect(path: &Path) -> GitStatus {
    if !path.join(".git").exists() {
        return GitStatus::error("não é um repositório git");
    }

    let branch = match run_git(path, &["rev-parse", "--abbrev-ref", "HEAD"]) {
        Some(b) if !b.is_empty() => b,
        _ => return GitStatus::error("não foi possível ler a branch"),
    };

    let dirty_files = run_git(path, &["status", "--porcelain"])
        .map(|out| {
            out.lines()
                .filter(|line| !line.trim().is_empty())
                .count() as u32
        })
        .unwrap_or(0);

    // Fails when there's no upstream tracking branch set — that's a normal
    // state (e.g. a brand-new branch), not an error worth surfacing.
    let unpushed_commits = run_git(path, &["rev-list", "--count", "@{u}..HEAD"])
        .and_then(|out| out.parse::<u32>().ok())
        .unwrap_or(0);

    // %cI = committer date, strict ISO 8601 — matches what the TS side expects.
    let last_commit =
        run_git(path, &["log", "-1", "--format=%cI%x1f%s"]).and_then(|out| {
            let mut parts = out.splitn(2, '\u{1f}');
            let date = parts.next()?.to_string();
            let message = parts.next().unwrap_or("").to_string();
            Some((date, message))
        });

    GitStatus {
        branch,
        dirty_files,
        unpushed_commits,
        last_commit_at: last_commit.as_ref().map(|(date, _)| date.clone()),
        last_commit_message: last_commit.map(|(_, msg)| msg),
        error: None,
    }
}
