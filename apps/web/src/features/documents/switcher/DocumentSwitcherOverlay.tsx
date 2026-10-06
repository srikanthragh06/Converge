import type { KeyboardEvent, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LuInfo, LuSearch } from "react-icons/lu";
import useDocumentSwitcher from "./hooks/useDocumentSwitcher";
import Skeleton from "@/components/ui/Skeleton";
import DelayedRender from "@/components/common/DelayedRender";
import { formatShortcut, IS_APPLE } from "@/lib/utils";
import DocumentSwitcherRow from "./DocumentSwitcherRow";
import SearchModeToggle from "./SearchModeToggle";
import LexicalResults from "./LexicalResults";
import SemanticResults from "./SemanticResults";

/**
 * The ⌘K search palette. With an empty box it lists recent documents;
 * typing searches titles and document content, lexically as you type or
 * semantically on ↵ (⌘/ switches the mode). Arrow keys move the focused row
 * and Enter opens it.
 * Built on Radix Dialog, so focus stays inside while open and Escape or a
 * backdrop click closes it.
 */
const DocumentSwitcherOverlay = ({
    onClose,
    documentId,
}: {
    /** Called to close the palette on Escape, backdrop click, or navigation. */
    onClose: () => void;
    documentId: number | undefined; // ID of the currently open document, left out of title matches
}) => {
    const {
        searchText,
        setSearchText,
        isBoxEmpty,
        mode,
        toggleMode,
        isLoading,
        titleRows,
        contentGroups,
        semanticStatus,
        isSemanticQueryEdited,
        runRowNavIndex,
        runSemanticSearch,
        openPassage,
        handleDocumentClick,
        inputRef,
        focusedIndex,
        listRef,
    } = useDocumentSwitcher(documentId, onClose); // palette state: search query, results, and keyboard focus

    /** Switches the mode and keeps typing in the search box. */
    const handleToggleMode = () => {
        toggleMode();
        inputRef.current?.focus();
    };

    /**
     * Switches the mode on ⌘/ (Ctrl / off Apple devices).
     * @param e - the search box's keydown event
     */
    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        const isMod = IS_APPLE ? e.metaKey : e.ctrlKey;
        if (isMod && e.key === "/") {
            e.preventDefault();
            toggleMode();
        }
    };

    let helpText = "Titles and exact words update as you type";
    if (mode === "semantic") {
        const isNoticeShown =
            !isSemanticQueryEdited &&
            (semanticStatus === "rateLimited" || semanticStatus === "failed");
        if (isNoticeShown) {
            helpText = "Lexical search keeps working";
        } else if (semanticStatus === "done" && !isSemanticQueryEdited) {
            helpText = "Showing passages by meaning, most relevant first";
        } else {
            helpText =
                "Semantic search runs only when you ask, so typing stays fast";
        }
    }

    let results: ReactNode;
    if (isBoxEmpty) {
        results = (
            <>
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                    Recent
                </p>
                {isLoading ? (
                    <DelayedRender>
                        <div className="flex flex-col gap-1">
                            {Array.from({ length: 4 }, (_, i) => (
                                <Skeleton
                                    key={i}
                                    height="2.75rem"
                                    width="100%"
                                />
                            ))}
                        </div>
                    </DelayedRender>
                ) : (
                    <div className="flex flex-col">
                        {titleRows.map((row) => (
                            <DocumentSwitcherRow
                                key={row.id}
                                navIndex={row.navIndex}
                                title={row.title}
                                isFocused={focusedIndex === row.navIndex}
                                onClick={() => handleDocumentClick(row.id)}
                            />
                        ))}
                    </div>
                )}
                <div className="mx-2.5 my-3 border-t border-line" />
                <p className="flex items-center gap-2 px-2.5 text-sm text-fg-muted">
                    <LuInfo className="h-4 w-4 shrink-0" />
                    Type to search titles and document content.
                </p>
            </>
        );
    } else if (mode === "lexical") {
        results = (
            <LexicalResults
                isLoading={isLoading}
                titleRows={titleRows}
                contentGroups={contentGroups}
                focusedIndex={focusedIndex}
                onOpenDocument={handleDocumentClick}
                onOpenPassage={openPassage}
            />
        );
    } else {
        results = (
            <SemanticResults
                query={searchText.trim()}
                runRowNavIndex={runRowNavIndex}
                status={semanticStatus}
                isQueryEdited={isSemanticQueryEdited}
                contentGroups={contentGroups}
                focusedIndex={focusedIndex}
                onRun={runSemanticSearch}
                onOpenDocument={handleDocumentClick}
                onOpenPassage={openPassage}
                onSearchLexically={handleToggleMode}
            />
        );
    }

    return (
        <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay" />
                <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center px-4 pt-16 sm:pt-[120px]">
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        className="pointer-events-auto flex max-h-[calc(100dvh-8rem)] w-full max-w-[760px] animate-modal-in flex-col overflow-hidden rounded-xl border border-line bg-surface-elevated text-fg shadow-2xl shadow-shadow outline-none"
                    >
                        <DialogPrimitive.Title className="sr-only">
                            Search documents
                        </DialogPrimitive.Title>

                        {/* Search row */}
                        <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line px-[18px]">
                            <LuSearch className="h-[18px] w-[18px] shrink-0 text-fg-muted" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Search titles and document content"
                                className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none"
                            />
                            <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] leading-none text-fg-muted sm:inline">
                                esc
                            </kbd>
                        </div>

                        {!isBoxEmpty && (
                            <SearchModeToggle
                                mode={mode}
                                onToggle={handleToggleMode}
                                helpText={helpText}
                            />
                        )}

                        {/* Results — every keyboard row inside carries its data-nav-index */}
                        <div
                            ref={listRef}
                            className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3"
                        >
                            {results}
                        </div>

                        {/* Key hints — hidden on phones, which have no arrow keys */}
                        <div className="hidden h-10 shrink-0 items-center gap-5 border-t border-line px-[18px] text-xs text-fg-muted sm:flex">
                            <span>↑↓ move</span>
                            <span>↵ open</span>
                            <span>
                                {formatShortcut("/")} switch Lexical ↔ Semantic
                            </span>
                            <span className="ml-auto">esc close</span>
                        </div>
                    </DialogPrimitive.Content>
                </div>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default DocumentSwitcherOverlay;
