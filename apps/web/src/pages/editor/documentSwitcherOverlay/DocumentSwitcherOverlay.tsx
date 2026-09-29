import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LuSearch } from "react-icons/lu";
import useDocumentSwitcher from "../../../hooks/useDocumentSwitcher";
import Skeleton from "../../../components/ui/Skeleton";
import DelayedRender from "../../../components/DelayedRender";
import DocumentSwitcherRow from "./DocumentSwitcherRow";

/**
 * The ⌘K search palette for quickly switching between documents. Shows the
 * user's library on open and supports debounced title search, with matches
 * highlighted in gold. Arrow keys move the focused row and Enter opens it.
 * Built on Radix Dialog, so focus stays inside while open and Escape or a
 * backdrop click closes it.
 */
const DocumentSwitcherOverlay = ({
    onClose,
    documentId,
}: {
    /** Called to close the palette on Escape, backdrop click, or navigation. */
    onClose: () => void;
    documentId: string | undefined; // ID of the currently open document, excluded from the results
}) => {
    const {
        searchText,
        setSearchText,
        documents,
        isLoading,
        matchQuery,
        inputRef,
        listRef,
        handleDocumentClick,
        focusedIndex,
    } = useDocumentSwitcher(
        documentId ? Number(documentId) : undefined,
        onClose,
    ); // palette state: search query, results, the query they matched, and keyboard focus

    return (
        <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay" />
                <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center px-4 pt-16 sm:pt-[120px]">
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        className="pointer-events-auto flex max-h-[calc(100dvh-8rem)] w-full max-w-[640px] animate-modal-in flex-col overflow-hidden rounded-xl border border-line bg-surface-elevated text-fg shadow-2xl shadow-shadow outline-none"
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
                                placeholder="Search documents…"
                                className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none"
                            />
                            <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] leading-none text-fg-muted sm:inline">
                                esc
                            </kbd>
                        </div>

                        {/* Results */}
                        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
                            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                                Documents
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
                            ) : documents.length === 0 ? (
                                <p className="px-2.5 py-3 text-sm text-fg-muted">
                                    No documents found.
                                </p>
                            ) : (
                                // Rows must be listRef's direct children: useKeyboardNav scrolls children[focusedIndex] into view.
                                <div ref={listRef} className="flex flex-col">
                                    {documents.map((doc, i) => (
                                        <DocumentSwitcherRow
                                            key={doc.id}
                                            title={doc.title}
                                            matchQuery={matchQuery}
                                            isFocused={focusedIndex === i}
                                            onClick={() =>
                                                handleDocumentClick(doc.id)
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Key hints — hidden on phones, which have no arrow keys */}
                        <div className="hidden h-10 shrink-0 items-center gap-5 border-t border-line px-[18px] text-xs text-fg-muted sm:flex">
                            <span>↑↓ to move</span>
                            <span>↵ to open</span>
                        </div>
                    </DialogPrimitive.Content>
                </div>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default DocumentSwitcherOverlay;
