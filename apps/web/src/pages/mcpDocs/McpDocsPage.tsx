import { useNavigate } from "react-router-dom";
import { LuCheck, LuCopy, LuKeyRound } from "react-icons/lu";
import Page from "../../components/Page";
import Button from "../../components/ui/Button";
import { PageContainer, PageHeader } from "../../components/ui/PageHeader";
import useCopyToClipboard from "../../hooks/useCopyToClipboard";
import ClientConfigTabs from "./ClientConfigTabs";
import ToolCapabilities from "./ToolCapabilities";
import StepSection from "./StepSection";
import CopyValueRow from "./CopyValueRow";
import { MCP_ENDPOINT, buildMcpDocsMarkdown } from "./mcpDocsContent";

/**
 * MCP setup page (pp 38 / 46): how to connect an AI agent client (Claude
 * Code, Cursor, Codex) to Converge over MCP, in three numbered steps — get
 * an API key (with the endpoint and auth header to copy), connect the
 * client, and what the tools can do. Copy as Markdown copies the whole
 * page, built from the same content.
 */
const McpDocsPage = () => {
    const navigate = useNavigate();
    const { copied, copy } = useCopyToClipboard(); // Copy as Markdown

    return (
        <Page authRequired haveSidebar mobileTitle="MCP setup">
            <div className="flex-1 overflow-y-auto">
                <PageContainer>
                    <PageHeader
                        title="Connect an AI agent"
                        description="Converge speaks the Model Context Protocol (MCP). Connect Claude Code, Cursor or Codex, and it can read, search and edit your documents."
                        aside={
                            <Button
                                onClick={() => copy(buildMcpDocsMarkdown())}
                                aria-label="Copy as Markdown"
                                className="self-start sm:self-center"
                            >
                                {copied ? <LuCheck /> : <LuCopy />}
                                <span className="hidden sm:inline">
                                    {copied ? "Copied" : "Copy as Markdown"}
                                </span>
                            </Button>
                        }
                    />

                    <div className="mt-2 flex flex-col gap-9 sm:gap-10">
                        <StepSection step={1} title="Get an API key">
                            <p className="text-sm text-fg-secondary">
                                Agents sign in with a Converge API key, not your
                                browser session. Anyone with the key can act as
                                you.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="primary"
                                    onClick={() =>
                                        navigate("/api-keys", {
                                            state: { createKey: true },
                                        })
                                    }
                                >
                                    <LuKeyRound />
                                    Create an API key
                                </Button>
                                <Button onClick={() => navigate("/api-keys")}>
                                    Manage keys
                                </Button>
                            </div>
                            <div className="mt-1 flex flex-col gap-2">
                                <CopyValueRow
                                    label="Endpoint"
                                    value={MCP_ENDPOINT}
                                />
                                <CopyValueRow
                                    label="Auth header"
                                    value="Authorization: Bearer <your-api-key>"
                                />
                            </div>
                        </StepSection>

                        <StepSection step={2} title="Connect your client">
                            <ClientConfigTabs />
                            <p className="text-xs text-fg-muted">
                                Restart your client, then ask it to list your
                                Converge workspaces to confirm.
                            </p>
                        </StepSection>

                        <StepSection step={3} title="What it can do">
                            <p className="text-sm text-fg-secondary">
                                Every tool follows the same access rules as you
                                do in the browser. Edits save a checkpoint
                                first, so they can be undone.
                            </p>
                            <ToolCapabilities />
                        </StepSection>
                    </div>
                </PageContainer>
            </div>
        </Page>
    );
};

export default McpDocsPage;
