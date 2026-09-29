import { TOOL_GROUPS } from "./mcpDocsContent";

/**
 * Every MCP tool Converge exposes (pp 38 / 46), grouped under small
 * uppercase labels, as a two-column grid of cards: title, tool name in
 * mono, and a one-line description.
 */
const ToolCapabilities = () => (
    <div className="flex flex-col gap-5">
        {TOOL_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    {group.title}
                </h3>
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    {group.tools.map((tool) => (
                        <div
                            key={tool.name}
                            className="flex flex-col gap-1 rounded-lg border border-line bg-surface-elevated px-4 py-3"
                        >
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                                <span className="text-sm font-semibold text-fg">
                                    {tool.title}
                                </span>
                                <span className="font-mono text-xs text-fg-muted">
                                    {tool.name}
                                </span>
                            </div>
                            <span className="text-sm text-fg-secondary">
                                {tool.description}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

export default ToolCapabilities;
