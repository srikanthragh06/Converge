import { Link } from "react-router-dom";
import { LuArrowRight, LuCode } from "react-icons/lu";

/**
 * Strip under the API keys header (pp 33 / 41) pointing to the MCP setup
 * page, where a key gets connected to an agent.
 */
const McpSetupBanner = () => (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-line bg-surface-elevated px-4 py-3 text-sm">
        <LuCode className="h-4 w-4 shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1 text-fg-secondary">
            Need to connect Claude Code, Cursor or Codex?
        </span>
        <Link
            to="/mcp-docs"
            className="flex shrink-0 items-center gap-1.5 rounded-sm font-semibold text-gold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-gold/60"
        >
            MCP setup
            <LuArrowRight className="h-4 w-4" />
        </Link>
    </div>
);

export default McpSetupBanner;
