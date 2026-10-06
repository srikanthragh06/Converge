import { cn } from "@/lib/utils";

/** The four access rules, in the order they're checked. */
const RULES = [
    { title: "Owner", description: "Always full access" },
    { title: "Direct", description: "Shared with a person" },
    { title: "Override", description: "Set on one document" },
    { title: "Default", description: "These settings" },
];

/**
 * "How access is decided" card under the Default access rows (pp 20 / 27):
 * the four tiers of document access resolution, first match wins. Mirrors
 * DocumentAccessService.resolveAccess on the server.
 */
const AccessRulesCard = () => (
    <div className="mt-6 rounded-xl border border-line bg-surface-inset p-5">
        <p className="text-sm font-semibold text-fg">How access is decided</p>
        <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {RULES.map((rule, i) => (
                <li key={rule.title} className="flex flex-col gap-1">
                    <span
                        className={cn(
                            "text-[13px] font-semibold",
                            i === 0 ? "text-gold" : "text-fg",
                        )}
                    >
                        {i + 1} · {rule.title}
                    </span>
                    <span className="text-xs text-fg-muted">
                        {rule.description}
                    </span>
                </li>
            ))}
        </ol>
        <p className="mt-4 text-xs text-fg-muted">
            The first rule that matches wins.
        </p>
    </div>
);

export default AccessRulesCard;
