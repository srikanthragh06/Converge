import { LuFile } from "react-icons/lu";
import Tooltip from "@/components/ui/Tooltip";
import PassageRow from "./PassageRow";
import type { ContentGroup } from "./hooks/useDocumentSwitcher";

/**
 * One document's matching passages in the search palette: a header with the
 * title and the passage count, then each passage. Clicking the header opens
 * the document at the top; clicking a passage opens it at that passage.
 * @param title - the document's title; empty renders "Untitled"
 * @param passages - the document's matching passages, best first, each with its keyboard index
 * @param focusedIndex - the keyboard-focused row's index, or null
 * @param isFirstPassageBestMatch - labels the first passage "Best match" (top semantic result)
 * @param onOpenDocument - opens the document
 * @param onOpenPassage - opens a passage by its url
 */
const ContentResultGroup = ({
    title,
    passages,
    focusedIndex,
    isFirstPassageBestMatch,
    onOpenDocument,
    onOpenPassage,
}: {
    title: string;
    passages: ContentGroup["passages"];
    focusedIndex: number | null;
    isFirstPassageBestMatch: boolean;
    onOpenDocument: () => void;
    onOpenPassage: (url: string) => void;
}) => {
    let countLabel = `${passages.length} passages`;
    if (passages.length === 1) countLabel = "1 passage";

    return (
        <div className="flex flex-col gap-1 pt-2">
            <div
                onClick={onOpenDocument}
                className="flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5"
            >
                <LuFile className="h-4 w-4 shrink-0 text-fg-muted" />
                <Tooltip content={title || "Untitled"}>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">
                        {title || "Untitled"}
                    </span>
                </Tooltip>
                <span className="shrink-0 text-xs text-fg-muted">
                    {countLabel}
                </span>
            </div>
            {passages.map((passage, i) => (
                <PassageRow
                    key={passage.navIndex}
                    snippet={passage.snippet}
                    navIndex={passage.navIndex}
                    isFocused={focusedIndex === passage.navIndex}
                    isBestMatch={isFirstPassageBestMatch && i === 0}
                    onClick={() => onOpenPassage(passage.url)}
                />
            ))}
        </div>
    );
};

export default ContentResultGroup;
