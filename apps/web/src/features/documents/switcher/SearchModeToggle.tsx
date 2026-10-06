import { cn, formatShortcut } from "@/lib/utils";

const MODES = [
    { mode: "lexical", label: "Lexical" },
    { mode: "semantic", label: "Semantic" },
] as const;

/**
 * The search palette's Lexical / Semantic switch, its ⌘/ (Ctrl /) hint, and
 * a line of help text for the current state. The hint and the help text are
 * hidden on phones.
 * @param mode - the active mode
 * @param onToggle - switches to the other mode
 * @param helpText - what the current mode or state does, e.g. "Titles and exact words update as you type"
 */
const SearchModeToggle = ({
    mode,
    onToggle,
    helpText,
}: {
    mode: "lexical" | "semantic";
    onToggle: () => void;
    helpText: string;
}) => (
    <div className="flex shrink-0 items-center gap-3 px-[18px] pt-3">
        <div
            role="tablist"
            className="flex gap-0.5 rounded-lg bg-surface-track p-1"
        >
            {MODES.map((option) => (
                <button
                    key={option.mode}
                    type="button"
                    role="tab"
                    aria-selected={mode === option.mode}
                    onClick={() => {
                        if (mode !== option.mode) onToggle();
                    }}
                    className={cn(
                        "cursor-pointer rounded-md px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60",
                        mode === option.mode
                            ? "bg-surface-elevated font-semibold text-fg shadow-sm shadow-shadow"
                            : "text-fg-muted hover:text-fg",
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
        <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] leading-none text-fg-muted sm:inline">
            {formatShortcut("/")}
        </kbd>
        <p className="ml-auto hidden min-w-0 truncate text-xs text-fg-muted sm:block">
            {helpText}
        </p>
    </div>
);

export default SearchModeToggle;
