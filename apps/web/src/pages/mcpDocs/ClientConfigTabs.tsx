import { useState } from "react";
import { CLIENT_CONFIGS } from "./mcpDocsContent";
import CodeBlock from "./CodeBlock";

/**
 * Tab switcher over CLIENT_CONFIGS — one tab per AI-agent client, each
 * showing its connection instructions and a copyable config snippet.
 */
const ClientConfigTabs = () => {
    const [activeId, setActiveId] = useState(CLIENT_CONFIGS[0].id); // Currently selected client tab.
    const active = CLIENT_CONFIGS.find((c) => c.id === activeId)!; // The config object for the selected tab — non-null since activeId always comes from CLIENT_CONFIGS itself.

    return (
        <div className="flex flex-col gap-3">
            {/* Tab buttons */}
            <div className="flex gap-1 border-b border-border/70">
                {CLIENT_CONFIGS.map((client) => (
                    <button
                        key={client.id}
                        onClick={() => setActiveId(client.id)}
                        className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-t-md cursor-pointer transition ${
                            client.id === activeId
                                ? "text-white border-b-2 border-white -mb-px"
                                : "text-text-disabled hover:text-text-secondary"
                        }`}
                    >
                        {client.label}
                    </button>
                ))}
            </div>

            {/* Active tab content */}
            <p className="text-xs sm:text-sm text-text-secondary">
                {active.instructions}
            </p>
            <CodeBlock code={active.snippet} />
            {active.note && (
                <p className="text-[11px] sm:text-xs text-text-disabled">
                    {active.note}
                </p>
            )}
        </div>
    );
};

export default ClientConfigTabs;
