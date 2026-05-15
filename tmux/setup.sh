#!/usr/bin/env bash

set -e

SESSION="converge"

# Attach if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach-session -t "$SESSION"
  exit 0
fi

# =========================
# Start docker first
# =========================

echo "Starting docker containers..."
docker compose -f docker-compose.dev.yml up --build -d

echo "Docker startup complete."

# =========================
# Window 0 -> infra
# =========================

tmux new-session -d -s "$SESSION" -n infra

# Split into 2 panes
tmux split-window -h -t "$SESSION":infra

# Even sizing
tmux select-layout -t "$SESSION":infra even-horizontal

# Pane 0 -> docker compose logs / shell
tmux send-keys -t "$SESSION":infra.0 \
  "docker compose -f docker-compose.dev.yml logs -f" C-m

# Pane 1 -> psql
tmux send-keys -t "$SESSION":infra.1 \
  "psql -h 127.0.0.1 -p 5432 -U converge -d converge" C-m

# =========================
# Window 1 -> logs
# =========================

tmux new-window -t "$SESSION" -n logs

tmux split-window -h -t "$SESSION":logs
tmux select-layout -t "$SESSION":logs even-horizontal

# Pane 0 -> backend logs
tmux send-keys -t "$SESSION":logs.0 \
  "docker logs -f converge2-server-1-1" C-m

# Pane 1 -> frontend logs
tmux send-keys -t "$SESSION":logs.1 \
  "docker logs -f converge2-web-1-1" C-m

# =========================
# Window 2 -> ai
# =========================

tmux new-window -t "$SESSION" -n ai

tmux split-window -h -t "$SESSION":ai
tmux select-layout -t "$SESSION":ai even-horizontal

# Pane 0 -> Claude
tmux send-keys -t "$SESSION":ai.0 \
  "claude" C-m

# Pane 1 -> Codex
tmux send-keys -t "$SESSION":ai.1 \
  "codex" C-m

# Open on AI window
tmux select-window -t "$SESSION":ai
tmux select-pane -t "$SESSION":ai.0

# Attach
tmux attach-session -t "$SESSION"