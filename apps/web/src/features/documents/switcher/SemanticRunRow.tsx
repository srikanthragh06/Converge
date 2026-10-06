import { LuSearch } from "react-icons/lu";
import { cn } from "@/lib/utils";

/**
 * The "Run semantic search for …" row. Semantic search makes a paid AI
 * call, so it runs only when the user picks this row (↵ or a click), never
 * while typing.
 * @param query - the search box's text, shown in quotes
 * @param navIndex - the row's index in the palette's keyboard list (useKeyboardNav)
 * @param isFocused - whether this row is the keyboard-focused one (Enter runs it)
 * @param onClick - runs the search
 */
const SemanticRunRow = ({
    query,
    navIndex,
    isFocused,
    onClick,
}: {
    query: string;
    navIndex: number;
    isFocused: boolean;
    onClick: () => void;
}) => (
    <div
        data-nav-index={navIndex}
        onClick={onClick}
        className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
            isFocused
                ? "border-gold bg-surface-selected"
                : "border-line hover:bg-surface-hover",
        )}
    >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-gold-fg">
            <LuSearch className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-fg">
                Run semantic search for “{query}”
            </p>
            <p className="truncate text-xs text-fg-muted">
                Finds passages that match the meaning, even with different words
            </p>
        </div>
        <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] leading-none text-fg-muted sm:inline">
            ↵
        </kbd>
    </div>
);

export default SemanticRunRow;
