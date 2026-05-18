"""
Deployment script for Converge — blue-green deployment.

On each run, determines which slot (blue: ports 5001–5003, green: ports
5004–5006) is currently live, builds and starts the inactive slot, waits
until all its containers are healthy, switches nginx over, then tears down
the old slot. The app stays up throughout with no downtime.

Usage:
    python deploy/deploy.py

Requirements:
    - SSH key auth configured for SERVER (no password prompt)
    - rsync installed locally
    - pnpm available locally
    - deploy/.env populated (see deploy/.env.example)
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

# Tracks which slot is currently live across deploys.
SLOT_FILE = f"{REMOTE_PROJECT}/.active-slot"
# Nginx include file containing the single active proxy_pass directive.
# Written by this script on every deploy to switch the active upstream.
NGINX_SLOT_CONF = "/etc/nginx/converge_slot.conf"
# Nginx site config — synced from the repo on every deploy.
NGINX_SITE_CONF = "/etc/nginx/sites-available/converge.conf"


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


def ssh_read(cmd: str) -> str:
    """Run a command on the server and return its stdout without aborting on failure.

    Used for reading state from the server (e.g. the active slot file) where
    a missing file or non-zero exit is expected and handled by the caller.

    @param cmd - Shell command to execute on the remote server.
    @returns The stdout of the command, stripped of leading/trailing whitespace.
    """
    result = subprocess.run(
        f'ssh -i "{PRIVATE_KEY_PATH}" {SERVER} "{cmd}"',
        shell=True, capture_output=True, text=True,
    )
    return result.stdout.strip()


def get_active_slot() -> str:
    """Read the currently live slot from the server, defaulting to blue on first deploy.

    @returns Either "blue" or "green".
    """
    # If the slot file doesn't exist yet (first deploy), default to blue so
    # the first deploy targets green.
    slot = ssh_read(f"cat {SLOT_FILE} 2>/dev/null || echo blue")
    return slot if slot in ("blue", "green") else "blue"


def inactive_slot(active: str) -> str:
    """Return the slot that is not currently live.

    @param active - The currently live slot ("blue" or "green").
    @returns The inactive slot.
    """
    return "green" if active == "blue" else "blue"


def main() -> None:
    """Run the full blue-green deploy sequence.

    Order: update server code → ensure nginx slot file exists → sync nginx
    config → start inactive slot and wait for healthy → switch nginx →
    stop old slot → build frontend → rsync dist.
    Any step failure aborts immediately, leaving the active slot untouched.
    """
    ssh_transport = f"ssh -i '{PRIVATE_KEY_PATH}'"

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

    # Determine which slot to deploy to.
    active = get_active_slot()
    inactive = inactive_slot(active)
    step(f"Active slot: {active} → deploying to: {inactive}")

    # Create the slot file if it doesn't exist yet so nginx can always load
    # the config without failing on a missing include file.
    step("Ensuring nginx slot file exists...")
    ssh(f"test -f {NGINX_SLOT_CONF} || echo 'proxy_pass http://converge_blue;' > {NGINX_SLOT_CONF}")

    # Sync the nginx config from the repo so it stays in version control.
    # Done before reloading nginx so the config and slot file are always in sync.
    step("Syncing nginx config...")
    run(f"rsync -avz -e '{ssh_transport}' {PROJECT_ROOT}/nginx/converge.conf {SERVER}:{NGINX_SITE_CONF}")

    # Build the inactive slot and block until all containers pass their
    # healthchecks. Migrations run on startup inside each container — if they
    # fail the container exits unhealthy and --wait returns non-zero, aborting
    # the deploy before nginx ever switches over.
    step(f"Building and starting {inactive} slot (waiting for healthy)...")
    ssh(f"cd {REMOTE_PROJECT} && docker compose -f docker-compose.{inactive}.yml up --build --wait")

    # Write the proxy_pass directive for the inactive slot, then reload nginx.
    # The reload is graceful — in-flight requests on the old upstream finish
    # before workers pick up the new config.
    step(f"Switching nginx to {inactive} slot...")
    ssh(f"echo 'proxy_pass http://converge_{inactive};' > {NGINX_SLOT_CONF} && nginx -s reload")

    # Old slot is no longer receiving traffic — safe to stop.
    step(f"Stopping {active} slot...")
    ssh(f"cd {REMOTE_PROJECT} && docker compose -f docker-compose.{active}.yml down")

    # Persist the new active slot so the next deploy knows what to replace.
    ssh(f"echo {inactive} > {SLOT_FILE}")

    step(f"Backend live on {inactive} slot.")

    # Build the Vite production bundle locally to avoid taxing the prod server.
    step("Building frontend...")
    run("pnpm --filter web build", cwd=PROJECT_ROOT)

    # --delete removes stale chunks from old builds so they don't accumulate.
    step("Syncing dist to server...")
    run(f"rsync -avz --delete -e '{ssh_transport}' {PROJECT_ROOT}/apps/web/dist/ {SERVER}:{REMOTE_DIST}")

    print("\n[DONE] Deploy complete.")


if __name__ == "__main__":
    main()
