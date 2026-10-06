import Skeleton from "@/components/ui/Skeleton";
import DelayedRender from "@/components/common/DelayedRender";
import { formatShortcut } from "@/lib/utils";
import DocumentSwitcherRow from "./DocumentSwitcherRow";
import ContentResultGroup from "./ContentResultGroup";
import type { ContentGroup } from "./hooks/useDocumentSwitcher";

/**
 * The search palette's lexical results: "Jump to" (title matches) above
 * "In documents" (passages with their matched words highlighted). Both come
 * from one load, so they appear together.
 * @param isLoading - whether the first results are still loading
 * @param titleRows - title matches, each with its keyboard index
 * @param contentGroups - documents with matching passages, best first
 * @param focusedIndex - the keyboard-focused row's index, or null
 * @param onOpenDocument - opens a document by id
 * @param onOpenPassage - opens a passage by its url
 */
const LexicalResults = ({
    isLoading,
    titleRows,
    contentGroups,
    focusedIndex,
    onOpenDocument,
    onOpenPassage,
}: {
    isLoading: boolean;
    titleRows: { id: number; title: string; navIndex: number }[];
    contentGroups: ContentGroup[];
    focusedIndex: number | null;
    onOpenDocument: (id: number) => void;
    onOpenPassage: (url: string) => void;
}) => {
    if (isLoading) {
        return (
            <DelayedRender>
                <div className="flex flex-col gap-1">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} height="2.75rem" width="100%" />
                    ))}
                </div>
            </DelayedRender>
        );
    }

    if (titleRows.length === 0 && contentGroups.length === 0) {
        return (
            <p className="px-2.5 py-3 text-sm text-fg-muted">
                No matches. Try Semantic ({formatShortcut("/")})
            </p>
        );
    }

    let passageCount = 0;
    for (const group of contentGroups) passageCount += group.passages.length;
    let passageLabel = `${passageCount} passages`;
    if (passageCount === 1) passageLabel = "1 passage";
    let documentLabel = `${contentGroups.length} documents`;
    if (contentGroups.length === 1) documentLabel = "1 document";

    return (
        <>
            {titleRows.length > 0 && (
                <div className="flex flex-col">
                    <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                        Jump to
                    </p>
                    {titleRows.map((row) => (
                        <DocumentSwitcherRow
                            key={row.id}
                            navIndex={row.navIndex}
                            title={row.title}
                            isFocused={focusedIndex === row.navIndex}
                            onClick={() => onOpenDocument(row.id)}
                        />
                    ))}
                </div>
            )}
            {titleRows.length > 0 && contentGroups.length > 0 && (
                <div className="mx-2.5 my-3 border-t border-line" />
            )}
            {contentGroups.length > 0 && (
                <div className="flex flex-col">
                    <p className="flex items-baseline gap-2 px-2.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                            In documents
                        </span>
                        <span className="text-xs text-fg-muted">
                            {passageLabel} in {documentLabel}
                        </span>
                    </p>
                    {contentGroups.map((group) => (
                        <ContentResultGroup
                            key={group.documentId}
                            title={group.title}
                            passages={group.passages}
                            focusedIndex={focusedIndex}
                            isFirstPassageBestMatch={false}
                            onOpenDocument={() =>
                                onOpenDocument(group.documentId)
                            }
                            onOpenPassage={onOpenPassage}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

export default LexicalResults;
