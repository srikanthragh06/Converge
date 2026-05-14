---
description: Review unstaged/staged changes, add comments, suggest fixes, then commit
---

## Context

- Git status: !`git status`
- Unstaged diff: !`git diff`
- Staged diff: !`git diff --cached`
- Untracked files: !`git ls-files --others --exclude-standard`
- Recent commits (for message style reference): !`git log --oneline -5`

## Your task

Follow these steps in order:

1. **Review the changes** — read every file listed in the unstaged diff, staged diff, and untracked file list in full to understand the changes.

2. **Add comments** — apply the documentation standard below to every new or changed file. Read each file in full before editing it. Do not add comments to trivially obvious code.

   ### Functions (all languages)
   - Every function must have an **inline doc comment** immediately above its signature describing what it does, its parameters, and its return value.
   - Inside the function body, break the logic into logical parts and add a **brief comment above each part** explaining what that part does.

   ### React components
   - For every `useState`, `useReducer`, or other state/variable declaration, add a **trailing inline comment** describing the variable's purpose.
   - Above every `useEffect`, add a **comment describing its purpose** — what it does and when it runs.

   ### Classes
   - For every class attribute/property, add a **trailing inline comment** describing what that attribute represents.

   For existing comments, verify they are:
   - Accurate and not stale relative to the current code
   - Written in full sentences with correct grammar and punctuation
   - Explaining *why*, not just *what* the code does

3. **Suggest improvements** — identify and flag any bugs, issues, or improvements. Apply fixes where appropriate. Check for:
   - Stale or incorrect comments
   - Missing error handling at system boundaries
   - Inconsistencies with the surrounding code style
   - Anything that could break at runtime
   - **Async error handling outside the NestJS pipeline** — any callback, event listener, or fire-and-forget async call that runs outside a `@SubscribeMessage` or HTTP handler (e.g. Redis pub/sub callbacks, `setTimeout`/`setInterval`, `EventEmitter` listeners) must have its own try-catch or `.catch()`. Errors in these contexts bypass `GlobalExceptionFilter` and will crash the process if unhandled.

4. **Confirm with the user** — summarise what you found and changed, then ask for confirmation before committing.

5. **Commit** — once confirmed, stage the relevant files and commit with a detailed multi-line message that explains *why* the changes were made, not just what changed. Do NOT add a Co-Authored-By trailer.
