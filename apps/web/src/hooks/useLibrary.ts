import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    GetLibraryDocumentsResponseDto,
    LibraryDocumentDto,
} from "@converge/shared";

/**
 * Manages library page state. Fetches the first page of the authenticated
 * user's documents on mount and exposes them alongside the search query.
 */
const useLibrary = () => {
    const [searchText, setSearchText] = useState(""); // current search query string
    const [documents, setDocuments] = useState<LibraryDocumentDto[]>([]); // current page of library documents

    // Fetches the first page of the user's library on mount.
    useEffect(() => {
        const fetchLibrary = async () => {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                );
            setDocuments(data.documents);
        };

        fetchLibrary();
    }, []);

    return { searchText, setSearchText, documents };
};

export default useLibrary;
