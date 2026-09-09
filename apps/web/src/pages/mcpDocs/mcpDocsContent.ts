/**
 * Single source of content for the MCP docs page — the rendered UI and the
 * "Copy as Markdown" button both build from these constants, so the two
 * can't drift out of sync.
 */

/** The MCP endpoint every client config below points at. */
export const MCP_ENDPOINT = "https://api.converge.1k5.in/mcp";

/** One AI-agent client's connection instructions and config snippet. */
export type ClientConfig = {
    id: string;
    label: string;
    instructions: string;
    snippet: string;
    /** Optional caveat shown under the snippet, e.g. for less-stable config formats. */
    note?: string;
};

export const CLIENT_CONFIGS: ClientConfig[] = [
    {
        id: "claude-code",
        label: "Claude Code",
        instructions: "Add Converge as a remote MCP server via the CLI:",
        snippet: `claude mcp add --transport http converge ${MCP_ENDPOINT} \\
  --header "Authorization: Bearer YOUR_API_KEY"`,
    },
    {
        id: "cursor",
        label: "Cursor",
        instructions:
            "Add this to .cursor/mcp.json (project) or ~/.cursor/mcp.json (global):",
        snippet: `{
  "mcpServers": {
    "converge": {
      "url": "${MCP_ENDPOINT}",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
    },
    {
        id: "codex",
        label: "Codex",
        instructions: "Add this to ~/.codex/config.toml:",
        snippet: `[mcp_servers.converge]
url = "${MCP_ENDPOINT}"
bearer_token_env_var = "CONVERGE_API_KEY"`,
        note: "Codex reads the token from an environment variable rather than the file — set CONVERGE_API_KEY in your shell before launching Codex. Config syntax here moves fast; check Codex's own MCP docs if this doesn't connect.",
    },
];

/** One MCP tool's display name and description, shown grouped by category. */
export type McpTool = {
    name: string;
    title: string;
    description: string;
};

export type ToolGroup = {
    title: string;
    tools: McpTool[];
};

export const TOOL_GROUPS: ToolGroup[] = [
    {
        title: "Discovery",
        tools: [
            {
                name: "listWorkspaces",
                title: "List Workspaces",
                description:
                    "Every workspace you're a member of, and your role in each.",
            },
            {
                name: "listDocuments",
                title: "List Documents",
                description:
                    "Documents in a workspace, newest last-visited first, paginated.",
            },
            {
                name: "searchDocuments",
                title: "Search Documents",
                description:
                    "Find a document by title match, ranked by relevance.",
            },
        ],
    },
    {
        title: "Documents",
        tools: [
            {
                name: "createDocument",
                title: "Create Document",
                description: "New empty document in a workspace.",
            },
            {
                name: "getDocumentMetadata",
                title: "Get Document Metadata",
                description:
                    "Title, workspace, resolved access level, created date.",
            },
            {
                name: "deleteDocument",
                title: "Delete Document",
                description: "Soft-delete a document — recoverable.",
            },
        ],
    },
    {
        title: "Content",
        tools: [
            {
                name: "readDocumentMarkdown",
                title: "Read Document Markdown",
                description: "Read content as Markdown — read-only, lossy.",
            },
            {
                name: "getDocumentBlocks",
                title: "Get Document Blocks",
                description: "Read the exact block structure, ids included.",
            },
            {
                name: "updateDocumentBlocks",
                title: "Update Document Blocks",
                description:
                    "Batch, atomic edits authored as Markdown — replace, insert, or remove blocks.",
            },
            {
                name: "updateDocumentTitle",
                title: "Update Document Title",
                description: "Rename a document.",
            },
        ],
    },
    {
        title: "Version history",
        tools: [
            {
                name: "listCheckpoints",
                title: "List Checkpoints",
                description:
                    "A document's saved versions, with contributors and source.",
            },
            {
                name: "getCheckpointContent",
                title: "Get Checkpoint Content",
                description: "Read a past version's full content.",
            },
            {
                name: "restoreCheckpoint",
                title: "Restore Checkpoint",
                description: "Roll a document back to a past version.",
            },
        ],
    },
    {
        title: "Trash",
        tools: [
            {
                name: "listDeletedDocuments",
                title: "List Deleted Documents",
                description: "Soft-deleted documents in a workspace.",
            },
            {
                name: "restoreDocument",
                title: "Restore Document",
                description: "Undelete a document.",
            },
        ],
    },
];

/** Assembles the whole page's content as one Markdown string for the copy button. */
export function buildMcpDocsMarkdown(): string {
    // Renders each client's instructions and snippet as a fenced code block under its own heading.
    const clientSections = CLIENT_CONFIGS.map(
        (client) =>
            `### ${client.label}\n\n${client.instructions}\n\n\`\`\`\n${client.snippet}\n\`\`\`${
                client.note ? `\n\n${client.note}` : ""
            }`,
    ).join("\n\n");

    // Renders each tool group as a heading followed by a bullet list of its tools.
    const toolSections = TOOL_GROUPS.map(
        (group) =>
            `### ${group.title}\n\n${group.tools
                .map(
                    (t) =>
                        `- **${t.title}** (\`${t.name}\`) — ${t.description}`,
                )
                .join("\n")}`,
    ).join("\n\n");

    return `# Connect an AI Agent to Converge

Converge exposes your documents to AI agents through the Model Context Protocol (MCP) — the same access-control rules that apply to you in the browser apply to any agent acting on your behalf. Connect a client like Claude Code, Cursor, or Codex, and it can read, search, and edit your documents directly.

## 1. Get an API key

Agents authenticate with a Converge API key, not your browser session. Go to **API Keys** in the sidebar, click **New Key**, and copy the value shown — it's only displayed once. Treat it like a password: anyone with the key can act as you, with your exact permissions.

- Endpoint: \`${MCP_ENDPOINT}\`
- Auth header: \`Authorization: Bearer <your-api-key>\`

## 2. Connect your client

${clientSections}

Restart your client, then ask it to list your Converge workspaces to confirm the connection.

## What it can do

${toolSections}

## Safety net

Every edit an agent makes is automatically checkpointed right before it lands, so an unwanted AI edit is always one restore away from undone.
`;
}
