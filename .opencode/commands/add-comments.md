---
description: Add inline documentation comments to unstaged diff changes or a specified folder, following project comment standards
---

## Arguments

`$ARGUMENTS` may be a folder path or empty.

- If a folder path is provided, apply the documentation standard to **all source files** in that folder (recursively).
- If empty, apply only to files that appear in the **unstaged diff or untracked files**: !`git diff --name-only; git ls-files --others --exclude-standard`

## Unstaged diff (for context when no folder is provided)

!`git diff`

## Documentation standard

Apply the following rules to every file in scope. Read each file in full before editing it.

### Functions (all languages)
- Every function must have an **inline doc comment** immediately above its signature describing what it does, its parameters, and its return value.
- Inside the function body, break the logic into logical parts and add a **brief comment above each part** explaining what that part does.

### React components
- For every `useState`, `useReducer`, or other state/variable declaration, add a **trailing inline comment** describing the variable's purpose (e.g., `// tracks whether the sidebar is open`).
- Above every `useEffect`, add a **comment describing its purpose** — what it does and when it runs.

### Classes
- For every class attribute/property (instance variables, class fields), add a **trailing inline comment** describing what that attribute represents.

## Your task

1. Determine the file list from the arguments or unstaged diff.
2. Read each file in full.
3. Apply the documentation standard above — add only what is missing. Do not remove or rewrite existing comments unless they are inaccurate.
4. Do not add comments to trivially obvious code (e.g., `// increment i` above `i++`).
5. After editing, summarise what was added across all files.
