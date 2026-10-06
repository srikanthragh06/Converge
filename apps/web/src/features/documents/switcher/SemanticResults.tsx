import type { ReactNode } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import ContentResultGroup from "./ContentResultGroup";
import type { ContentGroup } from "./hooks/useDocumentSwitcher";
import SemanticRunRow from "./SemanticRunRow";
import SemanticNoticeScreen from "./SemanticNoticeScreen";

/**
 * The search palette's semantic results. Nothing runs while typing: the
 * run row starts a search, and it comes back above the last results (now
 * dimmed) once the query is edited. A rate limit or a failure shows a
 * notice instead of results.
 * @param query - the search box's text
 * @param runRowNavIndex - the run row's keyboard index, or null when it's hidden
 * @param status - the last run's status (from useSemanticSearch)
 * @param isQueryEdited - whether the box no longer holds the query the results are for
 * @param contentGroups - documents with matching passages, most relevant first
 * @param focusedIndex - the keyboard-focused row's index, or null
 * @param onRun - runs a semantic search for the box's text
 * @param onOpenDocument - opens a document by id
 * @param onOpenPassage - opens a passage by its url
 * @param onSearchLexically - switches the palette to lexical mode
 */
const SemanticResults = ({
    query,
    runRowNavIndex,
    status,
    isQueryEdited,
    contentGroups,
    focusedIndex,
    onRun,
    onOpenDocument,
    onOpenPassage,
    onSearchLexically,
}: {
    query: string;
    runRowNavIndex: number | null;
    status: "idle" | "loading" | "rateLimited" | "failed" | "done";
    isQueryEdited: boolean;
    contentGroups: ContentGroup[];
    focusedIndex: number | null;
    onRun: () => void;
    onOpenDocument: (id: number) => void;
    onOpenPassage: (url: string) => void;
    onSearchLexically: () => void;
}) => {
    let body: ReactNode = null;
    if (isQueryEdited && status !== "done") {
        // Edited before any results came back: only the run row shows.
        body = null;
    } else if (status === "rateLimited" || status === "failed") {
        body = (
            <SemanticNoticeScreen
                reason={status}
                onSearchLexically={onSearchLexically}
            />
        );
    } else if (status === "loading") {
        body = (
            <div className="flex flex-col gap-2 pt-2">
                {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} height="4rem" width="100%" />
                ))}
            </div>
        );
    } else if (status === "done" && contentGroups.length === 0) {
        body = <p className="px-2.5 py-3 text-sm text-fg-muted">No matches.</p>;
    } else if (status === "done") {
        body = (
            <div className={cn("flex flex-col", isQueryEdited && "opacity-50")}>
                {contentGroups.map((group, i) => (
                    <ContentResultGroup
                        key={group.documentId}
                        title={group.title}
                        passages={group.passages}
                        focusedIndex={focusedIndex}
                        isFirstPassageBestMatch={i === 0}
                        onOpenDocument={() => onOpenDocument(group.documentId)}
                        onOpenPassage={onOpenPassage}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="flex items-baseline gap-2 px-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                    In documents
                </span>
                {status === "done" &&
                    !isQueryEdited &&
                    contentGroups.length > 0 && (
                        <span className="text-xs text-fg-muted">
                            Most relevant first
                        </span>
                    )}
            </p>
            {runRowNavIndex !== null && (
                <SemanticRunRow
                    query={query}
                    navIndex={runRowNavIndex}
                    isFocused={focusedIndex === runRowNavIndex}
                    onClick={onRun}
                />
            )}
            {body}
        </div>
    );
};

export default SemanticResults;
