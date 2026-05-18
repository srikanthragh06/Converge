"""
Deployment script for Converge.

SSHes into the production server to pull the latest code and rebuild the
backend Docker containers (migrations run automatically on startup), then
builds the frontend locally and rsyncs the dist to the server.

Usage:
    python deploy/deploy.py

Requirements:
    - SSH key auth configured for SERVER (no password prompt)
    - rsync installed locally
    - pnpm available locally
"""

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SERVER = os.environ["DEPLOY_SERVER"]
REMOTE_DIST = os.environ["DEPLOY_REMOTE_DIST"]
REMOTE_PROJECT = os.environ["DEPLOY_REMOTE_PROJECT"]
PRIVATE_KEY_PATH = os.environ["DEPLOY_PRIVATE_KEY_PATH"]
GITHUB_PAT = os.environ["DEPLOY_GITHUB_PAT"]
GITHUB_REPO = os.environ["DEPLOY_GITHUB_REPO"]

PROJECT_ROOT = Path(__file__).parent.parent


def step(msg: str) -> None:
    """Print a labelled deploy step header to stdout.

    @param msg - Human-readable description of the step being started.
    """
    print(f"\n==> {msg}")


def run(cmd: str, cwd: Path | None = None, display: str | None = None) -> None:
    """Run a shell command locally, aborting the deploy on failure.

    Prints the command before running it so the full sequence is visible in the
    terminal. Use display to substitute a redacted version when cmd contains
    secrets that should not appear in terminal output. Exits the process with
    the command's return code if it fails, preventing subsequent steps from
    running against a broken state.

    @param cmd - Shell command string to execute.
    @param cwd - Working directory to run the command in; defaults to the current directory.
    @param display - Optional redacted version of cmd to print instead of the real command.
    """
    print(f"    $ {display if display is not None else cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)

    # Any non-zero exit code means the step failed — abort immediately.
    if result.returncode != 0:
        print(f"\n[ERROR] Command failed with exit code {result.returncode}. Aborting.")
        sys.exit(result.returncode)


def ssh(cmd: str, display: str | None = None) -> None:
    """Run a command on the production server over a non-interactive SSH session.

    The connection opens, runs the command, then closes — no shell state
    persists between calls. Commands that depend on a working directory must
    chain with &&. Pass display to redact secrets from terminal output.

    @param cmd - Shell command to execute on the remote server.
    @param display - Optional redacted version of cmd to print instead of the real command.
    """
    # PRIVATE_KEY_PATH is quoted to handle paths that contain spaces.
    full_cmd = f'ssh -i "{PRIVATE_KEY_PATH}" {SERVER} "{cmd}"'
    full_display = f'ssh -i "{PRIVATE_KEY_PATH}" {SERVER} "{display}"' if display is not None else None
    run(full_cmd, display=full_display)


def main() -> None:
    """Run the full deploy sequence.

    Order: update server code → rebuild backend containers (migrations run on
    container startup) → build frontend locally → rsync dist to server.
    Any step failure aborts the deploy immediately.
    """
    # Update the server's working copy to the latest main.
    step("Checking out main branch on server...")
    ssh(f"cd {REMOTE_PROJECT} && git checkout main")

    step("Fetching latest from remote...")
    # Injects the PAT into the remote URL each time so the server never needs
    # its own GitHub credentials — token rotation is handled automatically.
    ssh(
        f"cd {REMOTE_PROJECT} && git remote set-url origin https://{GITHUB_PAT}@github.com/{GITHUB_REPO}.git && git fetch",
        display=f"cd {REMOTE_PROJECT} && git remote set-url origin https://***@github.com/{GITHUB_REPO}.git && git fetch",
    )

    step("Merging into main...")
    ssh(f"cd {REMOTE_PROJECT} && git merge")

    # Rebuild images from the updated source and start containers detached.
    # Migrations run automatically inside each container on startup — if they
    # fail the container exits and docker compose returns a non-zero code.
    step("Rebuilding and restarting backend (migrations run on startup)...")
    ssh(f"cd {REMOTE_PROJECT} && docker compose -f docker-compose.prod.yml up --build -d")

    step("Backend containers started.")

    # Build the Vite production bundle locally to avoid taxing the prod server.
    step("Building frontend...")
    run("pnpm --filter web build", cwd=PROJECT_ROOT)

    # --delete removes stale chunks from old builds so they don't accumulate.
    step("Syncing dist to server...")
    ssh_transport = f"ssh -i '{PRIVATE_KEY_PATH}'"
    run(
        f"rsync -avz --delete -e '{ssh_transport}' {PROJECT_ROOT}/apps/web/dist/ {SERVER}:{REMOTE_DIST}"
    )

    print("\n[DONE] Deploy complete.")


if __name__ == "__main__":
    main()
