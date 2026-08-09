---
description: Update AGENTS.md, ROADMAP.md, and README.md to mark a version as complete
---

## Context

- Current branch: !`git branch --show-current`
- Recent commits on this branch: !`git log main..HEAD --oneline`
- Current ROADMAP.md: !`cat ROADMAP.md`
- Current AGENTS.md: !`cat AGENTS.md`
- Current README.md: !`cat README.md`
- Current schema.md: !`cat schema.md`
- Current database schema types: !`cat apps/server/src/db/database.schema.ts`

## Your task

A version of Converge has just been completed. Update the four documentation files:

1. **ROADMAP.md** — Add or update the entry for the completed version:
   - Mark it as ✅ with the branch name
   - Summarise everything built in this version based on the commit history
   - Group changes by area (Web, Server, Tooling, etc.)
   - Leave an `## Upcoming` section at the bottom for future versions

2. **AGENTS.md** — Update any sections that are now stale:
   - Update the structure section if new packages were added
   - Add any new conventions or patterns established in this version
   - Keep it concise — this file is loaded into every Claude session

3. **README.md** — This is a portfolio-style showcase for recruiters (Features, Architecture, Technical Highlights, Stack, Docs sections), not a brief stub. Do not reduce it to a sentence or two:
   - Only touch it if this version changes something the README actually claims — the feature list, the architecture diagram/description, the tech stack table, or a technical highlight worth calling out
   - Preserve existing sections and recruiter-facing tone unless explicitly asked for a rewrite
   - If nothing in this version is README-worthy, leave it untouched

4. **schema.md** — Update to reflect the current database and Redis state:
   - Add, remove, or update table columns to match the current migrations
   - **For each table**, update the `#### Indexes` subsection — add index rows when new indexes were created, remove rows when indexes were dropped, and update the description when an index's purpose changes. Include both implicit indexes (PK, UNIQUE) and explicit indexes (CREATE INDEX), noting the type (B-tree, GIN, etc.) and what query patterns each index serves.
   - Update Redis channel payloads and lock keys if they changed
   - Keep descriptions accurate — flag stale comments

5. **Commit** — Stage and commit only the four .md files with a message like:
   `Mark v0.XX as complete — update ROADMAP, AGENTS.md, README, schema`
   Do NOT add a Co-Authored-By trailer.
