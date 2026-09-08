#!/usr/bin/env node
// Copies every file literally named ".env" from the main worktree checkout
// into the equivalent path in the current worktree. New worktrees don't get
// .env files (they're gitignored, not tracked), so this bootstraps them
// from whichever checkout git considers the main one, found generically via
// `git rev-parse --git-common-dir` rather than a hardcoded path.
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

const targetRoot = git("rev-parse --show-toplevel");
const commonGitDir = git("rev-parse --path-format=absolute --git-common-dir");
const sourceRoot = path.dirname(commonGitDir);

if (sourceRoot === targetRoot) {
  console.log("Already in the main checkout — nothing to copy.");
  process.exit(0);
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

async function findEnvFiles(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await findEnvFiles(path.join(dir, entry.name), results);
    } else if (entry.isFile() && entry.name === ".env") {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

const envFiles = await findEnvFiles(sourceRoot);

if (envFiles.length === 0) {
  console.log(`No .env files found under ${sourceRoot}`);
  process.exit(0);
}

for (const src of envFiles) {
  const rel = path.relative(sourceRoot, src);
  const dest = path.join(targetRoot, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  console.log(`Copied ${rel}`);
}

console.log(`Done — copied ${envFiles.length} .env file(s) from ${sourceRoot} to ${targetRoot}.`);
