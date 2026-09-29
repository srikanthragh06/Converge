import { useState } from "react";
import { cn } from "../../lib/utils";
import { CLIENT_CONFIGS } from "./mcpDocsContent";
import CodeBlock from "./CodeBlock";

/**
 * Tabs over CLIENT_CONFIGS (pp 38 / 46) — one per AI-agent client, with a
 * gold underline on the active one — each showing its instructions, a
 * copyable config snippet, and an optional note.
 */
const ClientConfigTabs = () => {
    const [activeId, setActiveId] = useState(CLIENT_CONFIGS[0].id); // currently selected client tab
    const active = CLIENT_CONFIGS.find((c) => c.id === activeId)!; // the selected client — non-null since activeId always comes from CLIENT_CONFIGS

    return (
        <div className="flex flex-col gap-3">
            <div role="tablist" className="flex gap-1 border-b border-line">
                {CLIENT_CONFIGS.map((client) => (
                    <button
                        key={client.id}
                        type="button"
                        role="tab"
                        aria-selected={client.id === activeId}
                        onClick={() => setActiveId(client.id)}
                        className={cn(
                            "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 sm:px-3.5",
                            client.id === activeId
                                ? "border-gold font-semibold text-fg"
                                : "border-transparent text-fg-muted hover:text-fg",
                        )}
                    >
                        {client.label}
                    </button>
                ))}
            </div>
            <p className="text-sm text-fg-secondary">{active.instructions}</p>
            <CodeBlock code={active.snippet} />
            {active.note && (
                <p className="text-xs text-fg-muted">{active.note}</p>
            )}
        </div>
    );
};

export default ClientConfigTabs;
