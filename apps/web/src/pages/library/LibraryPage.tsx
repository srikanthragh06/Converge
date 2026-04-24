import { useEffect, useState } from "react";
import Page from "../../components/Page";
import apiClient from "../../lib/http";
import type {
    GetLibraryDocumentsResponseDto,
    LibraryDocumentDto,
} from "@converge/shared";
import LibraryDocumentCard from "./components/LibraryDocumentCard";

/**
 * Full-screen library page. Lists the authenticated user's documents
 * with search, sorting, and infinite scroll.
 */
const LibraryPage = () => {
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

    return (
        <Page authRequired className="items-center">
            <div
                className="bg-background-base sticky sm:top-4 top-2 flex flex-col items-center space-y-2 w-5/6
                    sm:flex-row sm:items-center sm:space-y-0 sm:space-x-8 mx-2 
                    sm:w-auto
                    sm:mb-4 mb-2"
            >
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search documents..."
                    className="sm:w-[500px] w-full px-3 py-1 sm:text-base text-sm rounded-md 
                        bg-background-elevated 
                        outline-none text-white border-0"
                />
                <button
                    className="hidden sm:block sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                         hover:opacity-90 active:opacity-80 transition
                        cursor-pointer"
                >
                    New Document
                </button>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 w-full mt-6 mb-24 sm:mb-6">
                {documents.map((doc) => (
                    <LibraryDocumentCard key={doc.id} document={doc} />
                ))}
            </div>
            <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4">
                <button className="w-full px-2 py-2 text-xs rounded-md bg-white text-black hover:opacity-90 active:opacity-80 transition cursor-pointer">
                    New Document
                </button>
            </div>
        </Page>
    );
};

export default LibraryPage;
