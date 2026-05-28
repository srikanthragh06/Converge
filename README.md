# Converge

A Notion-style editor with live collaborative editing, workspaces, and granular access control.

**Live:** [converge.1k5.in](https://converge.1k5.in) · sign in with any Google account.

https://github.com/user-attachments/assets/e74a9a3b-8cf7-4625-925d-6fce35e5bfdd

## Features

- **Collaborative editing** with live presence avatars showing who is focused on which block
- **Rich-text editor** built on BlockNote, with image, video, and audio upload support
- **Workspaces** to organize documents into shared spaces with owner, admin, and member roles
- **Granular access control** with four tiers: workspace role defaults, per-doc overrides, explicit user grants, and workspace owner
- **Document library** with full-text search, infinite scroll, and a keyboard-navigable switcher (Ctrl+P)
- **Google OAuth** with secure httpOnly cookie sessions

## Architecture

```mermaid
graph TD
    B["Browser\nReact · Yjs · Socket.io"]
    N["nginx\nip_hash load balancer"]

    subgraph SC["Server Cluster"]
        S1["NestJS 1"]
        S2["NestJS 2"]
        S3["NestJS 3"]
    end

    PG[("PostgreSQL")]
    R[("Redis\npub/sub · locks · awareness · throttler")]
    G(["Google OAuth"])
    IK(["ImageKit CDN"])

    B -->|"HTTP + WebSocket"| N
    N -->|"sticky sessions"| S1
    N --> S2
    N --> S3

    S1 --> PG
    S2 --> PG
    S3 --> PG

    S1 <-->|"cross-server sync"| R
    S2 <--> R
    S3 <--> R

    B -.->|"direct upload"| IK
    B --> G
    G -->|"code exchange"| N
```

## Stack

React · NestJS · Yjs · BlockNote · PostgreSQL · Redis · Socket.io

## Docs

- [Roadmap](./ROADMAP.md)
- [Architecture](./docs/architecture-low-level.md)
