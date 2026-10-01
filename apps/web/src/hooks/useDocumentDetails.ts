import useDocument from "./useDocument";
import useDocumentOverview from "./useDocumentOverview";

/** How often the overview is re-fetched while the modal is open, so indexing status stays live. */
const POLL_INTERVAL_MS = 5000;

/**
 * Data for the Document details modal: the document overview (title, owner,
 * creator, created date, search indexing status) and the document itself
 * (workspace, the caller's resolved access). The overview is re-polled every
 * 5s while mounted, so a pending/indexing status turns into "Up to date"
 * live rather than only on the next open.
 * @param documentId - the document to describe
 */
const useDocumentDetails = (documentId: string | undefined) => {
    const id = Number(documentId);
    const { document, isLoading: isDocumentLoading } = useDocument(id);
    const { overview, isLoading: isOverviewLoading } = useDocumentOverview(
        id,
        POLL_INTERVAL_MS,
    );

    return {
        overview, // null while loading or on error
        document, // workspace and resolved access; null while loading or on error
        isLoading: isOverviewLoading || isDocumentLoading, // true until both loads settle
    };
};

export default useDocumentDetails;
