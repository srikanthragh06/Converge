import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type { GetDocumentResponseDto } from "@converge/shared";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { documentAccessAtom } from "../atoms/document";

/**
 * Fetches the document by ID on mount and whenever documentId changes, driving the document status state.
 * Navigates to /404 on a 404 response or any unexpected error; sets status to
 * "forbidden" on a 403. Seeds the title via setTitle on success.
 * @param documentId - the raw URL param string (undefined if the route param is missing)
 * @param setTitle - setter from useDocumentTitle used to seed the title from the server response
 */
const useDocumentFetch = (
    documentId: string | undefined,
    setTitle: React.Dispatch<React.SetStateAction<string>>,
) => {
    const navigate = useNavigate();
    const setDocumentAccess = useSetAtom(documentAccessAtom);

    const [documentStatus, setDocumentStatus] = useState<
        "loading" | "ready" | "forbidden" | "notFound"
    >("loading"); // tracks the outcome of the document fetch

    // Fetches the document whenever documentId changes — resets to loading first so stale content is hidden.
    useEffect(() => {
        setDocumentStatus("loading");
        const fetchDocument = async () => {
            try {
                const { data } = await apiClient.get<GetDocumentResponseDto>(
                    `/document/id/${documentId || ""}`,
                );
                setTitle(data.title);
                setDocumentAccess(data.resolvedAccess);
                setDocumentStatus("ready");
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    const statusCode = err.response?.status;
                    if (statusCode === 403) {
                        setDocumentStatus("forbidden");
                        return;
                    } else if (statusCode === 404) {
                        setDocumentStatus("notFound");
                        navigate("/404");
                        return;
                    }
                }
                // Treat all other errors (network failure, unexpected status, etc.) as not found.
                setDocumentStatus("notFound");
                navigate("/404");
            }
        };

        fetchDocument();

        return () => setDocumentAccess(null);
    }, [documentId]);

    return { documentStatus };
};

export default useDocumentFetch;
