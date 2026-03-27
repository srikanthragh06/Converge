# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Converge is a full-stack Notion-like application (early stage). See ROADMAP.md for version history and what has been built so far.

## Structure

- `web/` — React + Vite + Tailwind CSS v3 frontend
- `server/` — NestJS + Socket.io backend

## Code Style

- Use Prettier for formatting. Follow Prettier rules in all code written for this project.
- NestJS file naming: kebab-case with type suffix (e.g. `document.service.ts`, `global-exception.filter.ts`).
- Layered architecture: controllers → services → repositories. Keep business logic in services.

## Conventions

- All API responses use the `ApiResponse<T>` envelope from `server/src/utils/response.util.ts`.
- Environment config: `.env.<NODE_ENV>` takes precedence, `.env` is the shared fallback.
- All color values are defined in `web/src/theme/colors.ts`. Reference them in `editorTheme.ts` and as Tailwind classes — do not hardcode hex values elsewhere.
- Tailwind's preflight is disabled (`corePlugins.preflight: false`) to avoid conflicts with Mantine/BlockNote styles. Add manual resets in `index.css` when needed.
