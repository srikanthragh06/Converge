import { useState } from "react";
import { useAtomValue } from "jotai";
import { LuPlus, LuSearch } from "react-icons/lu";
import Page from "../../components/Page";
import Input from "../../components/ui/Input";
import TableSkeleton from "../../components/ui/TableSkeleton";
import { PageContainer, PageHeader } from "../../components/ui/PageHeader";
import { Table, TableHeadCell, TableHeader } from "../../components/ui/Table";
import { currentWorkspaceAtom } from "../../atoms/sidebar";
import useLibrary from "../../hooks/useLibrary";
import useNewDocument from "../../hooks/useNewDocument";
import usePinnedDocuments from "../../hooks/usePinnedDocuments";
import useDocumentRowMenu from "../../hooks/useDocumentRowMenu";
import LibraryRow from "./components/LibraryRow";

/**
 * Library page (pp 29 / 30, phones pp 82 / 88): every document the user can
 * open in the current workspace, most recently visited first, with a title
 * filter, a New document button, and infinite scroll. Rows carry the same
 * ⋯ / right-click menu as the sidebar's.
 */
const LibraryPage = () => {
    const [searchText, setSearchText] = useState(""); // the filter box's text
    const { documents, isLoading, isFetchingMore, sentinelRef } =
        useLibrary(searchText); // the paginated list, or the matches for searchText
    const { createDocument, isCreating } = useNewDocument();
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // named in the subtitle
    const { pinnedDocuments } = usePinnedDocuments(); // every pinned document in the workspace (the sidebar's unpaginated list)
    const { documentMenu, togglePin } = useDocumentRowMenu(); // row ⋯ / right-click menu and pin toggle
    const pinnedIds = new Set(pinnedDocuments.map((d) => d.id)); // ids of pinned documents, for each row's pin
    const isFiltering = searchText.trim() !== ""; // a filter is set, so an empty list means no match

    return (
        <Page authRequired haveSidebar mobileTitle="Library">
            <div className="flex-1 overflow-y-auto">
                <PageContainer>
                    <PageHeader
                        title="Library"
                        description={
                            currentWorkspace &&
                            `Every document you can open in ${currentWorkspace.name}.`
                        }
                        action={{
                            label: "New document",
                            icon: <LuPlus />,
                            onClick: createDocument,
                            disabled: isCreating,
                        }}
                    >
                        <Input
                            inputSize="lg"
                            icon={<LuSearch />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Filter by title"
                            aria-label="Filter documents by title"
                        />
                    </PageHeader>
                    <Table
                        columns="minmax(0,1fr) 7rem 8rem 6rem 3.5rem"
                        mobileColumns="minmax(0,1fr) auto"
                    >
                        <TableHeader>
                            <TableHeadCell>Title</TableHeadCell>
                            <TableHeadCell hideOnMobile>
                                Your access
                            </TableHeadCell>
                            <TableHeadCell hideOnMobile>
                                Last visited
                            </TableHeadCell>
                            <TableHeadCell hideOnMobile>Edited</TableHeadCell>
                            <TableHeadCell />
                        </TableHeader>
                        {documents.map((doc) => {
                            const isPinned = pinnedIds.has(doc.id);
                            return (
                                <LibraryRow
                                    key={doc.id}
                                    document={doc}
                                    isPinned={isPinned}
                                    menuItems={documentMenu(doc, isPinned)}
                                    onTogglePin={() =>
                                        togglePin(doc, !isPinned)
                                    }
                                />
                            );
                        })}
                        {(isLoading || isFetchingMore) && (
                            <TableSkeleton rows={documents.length ? 2 : 6} />
                        )}
                        {!isLoading && documents.length === 0 && (
                            <p className="py-10 text-center text-sm text-fg-muted">
                                {isFiltering
                                    ? "No documents match this filter."
                                    : "No documents yet."}
                            </p>
                        )}
                    </Table>
                    <div ref={sentinelRef} />
                </PageContainer>
            </div>
        </Page>
    );
};

export default LibraryPage;
