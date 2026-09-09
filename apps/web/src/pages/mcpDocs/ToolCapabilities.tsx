import { TOOL_GROUPS } from "./mcpDocsContent";

/** Grouped, read-only listing of every MCP tool Converge exposes. */
const ToolCapabilities = () => {
    return (
        <div className="flex flex-col gap-5">
            {TOOL_GROUPS.map((group) => (
                <div key={group.title} className="flex flex-col gap-2">
                    <h3 className="text-xs sm:text-sm font-semibold text-text-disabled uppercase tracking-wide">
                        {group.title}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-1.5">
                        {group.tools.map((tool) => (
                            <div
                                key={tool.name}
                                className="flex flex-col gap-0.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-md
                    bg-background-elevated border border-border/70"
                            >
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs sm:text-sm text-white font-medium shrink-0">
                                        {tool.title}
                                    </span>
                                    <span className="text-[10px] sm:text-xs text-text-disabled font-mono shrink-0">
                                        {tool.name}
                                    </span>
                                </div>
                                <span className="text-xs sm:text-sm text-text-secondary">
                                    {tool.description}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ToolCapabilities;
