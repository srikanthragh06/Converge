import { cn } from "@/lib/utils";
import HighlightedSnippet from "./HighlightedSnippet";

/**
 * One matching passage under its document in the search palette: a
 * two-line snippet behind a left rule. The top semantic result is labelled
 * "Best match" and gets a gold rule.
 * @param snippet - the passage's snippet text
 * @param navIndex - the row's index in the palette's keyboard list (useKeyboardNav)
 * @param isFocused - whether this row is the keyboard-focused one (Enter opens it)
 * @param isBestMatch - whether this is the top semantic result
 * @param onClick - opens the passage
 */
const PassageRow = ({
    snippet,
    navIndex,
    isFocused,
    isBestMatch,
    onClick,
}: {
    snippet: string;
    navIndex: number;
    isFocused: boolean;
    isBestMatch: boolean;
    onClick: () => void;
}) => (
    <div
        data-nav-index={navIndex}
        onClick={onClick}
        className={cn(
            "ml-[26px] cursor-pointer rounded-r-lg border-l-2 py-2.5 pl-4 pr-3 text-sm leading-relaxed text-fg-secondary transition-colors",
            isBestMatch ? "border-gold" : "border-line",
            isFocused ? "bg-surface-selected" : "hover:bg-surface-hover",
        )}
    >
        {isBestMatch && (
            <p className="mb-0.5 text-[11px] font-semibold text-gold">
                Best match
            </p>
        )}
        <p className="line-clamp-2">
            <HighlightedSnippet snippet={snippet} />
        </p>
    </div>
);

export default PassageRow;
