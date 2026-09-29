import { useState } from "react";
import { LuSearch } from "react-icons/lu";
import Page from "../../components/Page";
import Input from "../../components/ui/Input";
import TableSkeleton from "../../components/ui/TableSkeleton";
import { PageContainer, PageHeader } from "../../components/ui/PageHeader";
import { Table, TableHeadCell, TableHeader } from "../../components/ui/Table";
import useTrash from "../../hooks/useTrash";
import TrashRow from "./TrashRow";

/**
 * Trash page (pp 37 / 45): the current workspace's deleted documents, newest
 * first, with a title filter and a Restore button on each row. Restoring
 * shows a toast whose Open action opens the document. Loads more pages as
 * the list scrolls.
 */
const TrashPage = () => {
    const [filterText, setFilterText] = useState(""); // title filter typed into the filter bar
    const {
        documents,
        isLoadingMore,
        sentinelRef,
        restoringId,
        restoreDocument,
    } = useTrash(filterText); // filtered deleted documents, pagination, and restore state
    const isFiltering = filterText.trim() !== ""; // a filter is set, so an empty list means no match

    return (
        <Page authRequired haveSidebar mobileTitle="Trash">
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
                                onRestore={restoreDocument}
                            />
                        ))}
                        {isLoadingMore && (
                            <TableSkeleton rows={documents.length ? 2 : 5} />
                        )}
                        {!isLoadingMore && documents.length === 0 && (
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
