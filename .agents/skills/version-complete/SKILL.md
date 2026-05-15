---
name: version-complete
description: Use when the user asks to run version-complete, mark a version as complete, or follow the workflow defined in `.opencode/commands/version-complete.md`.
---

# Version Complete

This skill mirrors the repo's OpenCode command at `.opencode/commands/version-complete.md`.

## Workflow

1. Read `.opencode/commands/version-complete.md` in full before doing any work.
2. Treat that file as the source of truth for the workflow, including its required context, document update scope, and commit requirements.
3. Execute the workflow in order.
4. Keep the edits scoped to the files named by the command unless the user explicitly broadens the task.
5. If the markdown command and this skill ever diverge, follow `.opencode/commands/version-complete.md`.
