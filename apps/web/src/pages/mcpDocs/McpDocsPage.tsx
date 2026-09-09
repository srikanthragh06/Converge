import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdCheck, MdContentCopy, MdVpnKey } from "react-icons/md";
import Page from "../../components/Page";
import ClientConfigTabs from "./ClientConfigTabs";
import ToolCapabilities from "./ToolCapabilities";
import { MCP_ENDPOINT, buildMcpDocsMarkdown } from "./mcpDocsContent";

/**
 * Full-screen docs page explaining how to connect an AI agent client
 * (Claude Code, Cursor, Codex) to Converge over MCP, and what the exposed
 * tools can do. Reached via the MCP button in the sidebar.
 */
const McpDocsPage = () => {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false); // True briefly after "Copy as Markdown" succeeds, to swap the button's icon/label.

    /** Copies the whole page's content, assembled from the same data the UI renders, as Markdown. */
    const handleCopyMarkdown = async () => {
        try {
            await navigator.clipboard.writeText(buildMcpDocsMarkdown());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy docs as Markdown:", err);
        }
    };

    return (
        <Page authRequired haveSidebar>
            <div className="flex-1 overflow-y-auto flex flex-col items-center pb-16">
                <div className="w-full sm:max-w-[1080px] flex flex-col gap-6 sm:gap-8 px-3 sm:px-8 pt-3 sm:pt-8">
                    {/* Header — title + copy-as-markdown on one row, description on its own full-width row below */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-4">
                            <h1 className="sm:text-3xl text-xl font-bold text-text-primary">
                                Connect an AI Agent
                            </h1>
                            <button
                                onClick={handleCopyMarkdown}
                                aria-label="Copy as Markdown"
                                className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-md
                                    bg-background-elevated border border-border/70 text-white
                                    cursor-pointer hover:opacity-80 active:opacity-70 transition shrink-0"
                            >
                                {copied ? (
                                    <MdCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                                ) : (
                                    <MdContentCopy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                )}
                                <span className="hidden sm:inline">
                                    {copied ? "Copied" : "Copy as Markdown"}
                                </span>
                            </button>
                        </div>
                        <p className="text-sm sm:text-base text-text-secondary">
                            Converge exposes your documents to AI agents through
                            the Model Context Protocol (MCP) — the same
                            access-control rules that apply to you in the
                            browser apply to any agent acting on your behalf.
                            Connect a client like Claude Code, Cursor, or Codex,
                            and it can read, search, and edit your documents
                            directly.
                        </p>
                    </div>

                    {/* Step 1 — API key */}
                    <section className="flex flex-col gap-3">
                        <h2 className="text-lg sm:text-xl font-semibold text-white">
                            1. Get an API key
                        </h2>
                        <p className="text-sm text-text-secondary">
                            Agents authenticate with a Converge API key, not
                            your browser session. Go to{" "}
                            <span className="text-white">API Keys</span> in the
                            sidebar, click{" "}
                            <span className="text-white">New Key</span>, and
                            copy the value shown — it's only displayed once.
                            Treat it like a password: anyone with the key can
                            act as you, with your exact permissions.
                        </p>
                        <div>
                            <button
                                onClick={() => navigate("/api-keys")}
                                className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-md
                                    bg-white text-black cursor-pointer hover:opacity-90 active:opacity-80 transition"
                            >
                                <MdVpnKey className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                Go to API Keys
                            </button>
                        </div>
                        <div className="flex flex-col gap-1 text-[11px] sm:text-sm text-text-secondary font-mono break-all">
                            <span>
                                Endpoint:{" "}
                                <span className="text-white">
                                    {MCP_ENDPOINT}
                                </span>
                            </span>
                            <span>
                                Auth header:{" "}
                                <span className="text-white">
                                    Authorization: Bearer &lt;your-api-key&gt;
                                </span>
                            </span>
                        </div>
                    </section>

                    {/* Step 2 — client setup */}
                    <section className="flex flex-col gap-3">
                        <h2 className="text-lg sm:text-xl font-semibold text-white">
                            2. Connect your client
                        </h2>
                        <ClientConfigTabs />
                        <p className="text-sm text-text-secondary">
                            Restart your client, then ask it to list your
                            Converge workspaces to confirm the connection.
                        </p>
                    </section>

                    {/* Capabilities */}
                    <section className="flex flex-col gap-3">
                        <h2 className="text-lg sm:text-xl font-semibold text-white">
                            What it can do
                        </h2>
                        <ToolCapabilities />
                    </section>

                    {/* Safety net callout */}
                    <div className="px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-md bg-background-elevated border border-border/70 text-xs sm:text-sm text-text-secondary">
                        Every edit an agent makes is automatically checkpointed
                        right before it lands — so an unwanted AI edit is always
                        one restore away from undone.
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default McpDocsPage;
