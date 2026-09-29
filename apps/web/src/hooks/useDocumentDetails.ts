import { useEffect, useState } from "react";
import type {
    GetDocumentOverviewResponseDto,
    GetDocumentResponseDto,
} from "@converge/shared";
import apiClient from "../lib/http";

/** How often the overview is re-fetched while the modal is open, so indexing status stays live. */
const POLL_INTERVAL_MS = 5000;

/**
 * Data for the Document details modal: the document overview (title, owner,
 * creator, created date, search indexing status) and the document itself
 * (workspace, the caller's resolved access), fetched in parallel on open.
 * The overview is re-polled every 5s while mounted, so a pending/indexing
 * status turns into "Up to date" live rather than only on the next open.
 * @param documentId - the document to describe
 */
const useDocumentDetails = (documentId: string | undefined) => {
    const [overview, setOverview] =
        useState<GetDocumentOverviewResponseDto | null>(null); // overview fields; null while loading or on error
    const [document, setDocument] = useState<GetDocumentResponseDto | null>(
        null,
    ); // workspace and resolved access; null while loading or on error
    const [isLoading, setIsLoading] = useState(true); // true until the first fetches settle

    // Fetches both on open, then keeps polling the overview.
    useEffect(() => {
        if (!documentId) return;

        /** Fetches the overview; also called by the polling interval. */
        const fetchOverview = async () => {
            try {
                const { data } =
                    await apiClient.get<GetDocumentOverviewResponseDto>(
                        `/document/${documentId}/overview`,
                    );
                setOverview(data);
            } catch (err) {
                console.error(
                    "useDocumentDetails: failed to fetch overview:",
                    err,
                );
            }
        };

        /** Fetches the document's workspace and the caller's resolved access. */
        const fetchDocument = async () => {
            try {
                const { data } = await apiClient.get<GetDocumentResponseDto>(
                    `/document/id/${documentId}`,
                );
                setDocument(data);
            } catch (err) {
                console.error(
                    "useDocumentDetails: failed to fetch document:",
                    err,
                );
            }
        };

        Promise.all([fetchOverview(), fetchDocument()]).finally(() =>
            setIsLoading(false),
        );
        const intervalId = setInterval(fetchOverview, POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [documentId]);

    return { overview, document, isLoading };
};

export default useDocumentDetails;
