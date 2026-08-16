---
description: Update AGENTS.md, ROADMAP.md, README.md, and schema.md to mark a release as complete, ahead of merging the release branch into main
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

Converge no longer ships numbered versions. Feature branches merge into a release branch, and this command runs once on the release branch — after all of its feature branches have landed — right before that release branch is merged into `main`. Update the four documentation files:

1. **ROADMAP.md** — Add an entry for the completed release:
   - Heading is a short descriptive title for what the release shipped, marked ✅ — no version number (e.g. `## Document References & Offline Support ✅`)
   - Note the release branch name and completion date underneath, e.g. `> Branch: \`release/document-references\` — merged <date>`
   - Summarise everything built in this release based on the commit history (`git log main..HEAD` spans every feature branch already merged into this release branch)
   - Group changes by area (Web, Server, Tooling, etc.)
   - Leave an `## Upcoming` section at the bottom for work not yet started

2. **AGENTS.md** — Update any sections that are now stale:
   - Update the structure section if new packages were added
   - Add any new conventions or patterns established in this release
   - Keep it concise — this file is loaded into every Claude session

3. **README.md** — This is a portfolio-style showcase for recruiters (Features, Architecture, Technical Highlights, Stack, Docs sections), not a brief stub. Do not reduce it to a sentence or two:
   - Only touch it if this release changes something the README actually claims — the feature list, the architecture diagram/description, the tech stack table, or a technical highlight worth calling out
   - Preserve existing sections and recruiter-facing tone unless explicitly asked for a rewrite
   - If nothing in this release is README-worthy, leave it untouched

4. **schema.md** — Update to reflect the current database and Redis state:
   - Add, remove, or update table columns to match the current migrations
   - **For each table**, update the `#### Indexes` subsection — add index rows when new indexes were created, remove rows when indexes were dropped, and update the description when an index's purpose changes. Include both implicit indexes (PK, UNIQUE) and explicit indexes (CREATE INDEX), noting the type (B-tree, GIN, etc.) and what query patterns each index serves.
   - Update Redis channel payloads and lock keys if they changed
   - Keep descriptions accurate — flag stale comments

5. **Commit** — Stage and commit only the four .md files with a message like:
   `Mark <release title> as complete — update ROADMAP, AGENTS.md, README, schema`
   Do NOT add a Co-Authored-By trailer.

6. **Stop here** — do not merge the release branch into `main` yourself. A repo hook blocks git commands that target `main` directly (`checkout main`, `switch main`, `merge main`, etc.), and merging into main is a manual step for the user (typically via PR). Once the commit above lands, tell the user the release branch is ready to merge.
