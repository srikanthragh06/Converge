import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuSearch } from "react-icons/lu";
import Page from "../../components/Page";
import MobileTopBar from "../../components/MobileTopBar";
import Input from "../../components/ui/Input";
import TableSkeleton from "../../components/ui/TableSkeleton";
import { PageContainer, PageHeader } from "../../components/ui/PageHeader";
import { Table, TableHeadCell, TableHeader } from "../../components/ui/Table";
import useTrash from "../../hooks/useTrash";
import useRestoreDocument from "../../hooks/useRestoreDocument";
import { showToast } from "../../lib/toast";
import TrashRow from "./TrashRow";

/**
 * Trash page (pp 37 / 45): the current workspace's deleted documents, newest
 * first, with a title filter and a Restore button on each row. Restoring
 * shows a toast whose Open action opens the document. Loads more pages as
 * the list scrolls.
 */
const TrashPage = () => {
    const [filterText, setFilterText] = useState(""); // title filter typed into the filter bar
    const { documents, isLoading, isFetchingMore, sentinelRef } =
        useTrash(filterText); // filtered deleted documents and pagination
    const navigate = useNavigate();
    const { restoreDocument, restoringId } = useRestoreDocument({
        onSuccess: (doc) =>
            showToast(`Restored "${doc.title || "Untitled"}"`, {
                action: {
                    label: "Open",
                    onClick: () => navigate(`/document/${doc.id}`),
                },
            }),
    });
    const isFiltering = filterText.trim() !== ""; // a filter is set, so an empty list means no match

    return (
        <Page authRequired haveSidebar>
            <MobileTopBar title="Trash" />
            <div className="flex-1 overflow-y-auto">
                <PageContainer>
                    <PageHeader
                        title="Trash"
                        description="Deleted documents stay here until you restore them."
                    >
                        <Input
                            inputSize="lg"
                            icon={<LuSearch />}
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder="Filter deleted documents"
                            aria-label="Filter deleted documents"
                        />
                    </PageHeader>
                    <Table
                        columns="minmax(0,1fr) 9rem 7rem"
                        mobileColumns="minmax(0,1fr) auto"
                    >
                        <TableHeader>
                            <TableHeadCell>Title</TableHeadCell>
                            <TableHeadCell hideOnMobile>Deleted</TableHeadCell>
                            <TableHeadCell />
                        </TableHeader>
                        {documents.map((doc) => (
                            <TrashRow
                                key={doc.id}
                                document={doc}
                                isRestoring={restoringId === doc.id}
                                onRestore={() => restoreDocument(doc)}
                            />
                        ))}
                        {(isLoading || isFetchingMore) && (
                            <TableSkeleton rows={documents.length ? 2 : 5} />
                        )}
                        {!isLoading && documents.length === 0 && (
                            <p className="py-10 text-center text-sm text-fg-muted">
                                {isFiltering
                                    ? "No deleted documents match this filter."
                                    : "Trash is empty."}
                            </p>
                        )}
                    </Table>
                    <div ref={sentinelRef} />
                </PageContainer>
            </div>
        </Page>
    );
};

export default TrashPage;
