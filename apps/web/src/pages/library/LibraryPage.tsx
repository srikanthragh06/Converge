import { useEffect, useState } from "react";
import Page from "../../components/Page";
import apiClient from "../../lib/http";
import type { GetLibraryDocumentsResponseDto } from "@converge/shared";

/**
 * Full-screen library page. Lists the authenticated user's documents
 * with search, sorting, and infinite scroll.
 */
const LibraryPage = () => {
    const [searchText, setSearchText] = useState(""); // current search query string

    // Fetches the first page of the user's library on mount and logs the response.
    useEffect(() => {
        const fetchLibrary = async () => {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                );
            console.log(data);
        };

        fetchLibrary();
    }, []);

    return (
        <Page authRequired>
            <div className="flex flex-col items-center">
                <div
                    className="flex flex-col items-center space-y-2 w-5/6
                    sm:flex-row sm:items-center sm:space-y-0 sm:space-x-8 mx-2 
                    sm:w-auto sm:mt-8 mt-4"
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
                        className=" hidden  sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                         hover:opacity-90 active:opacity-80 transition
                        cursor-pointer"
                    >
                        New Document
                    </button>
                </div>
            </div>
        </Page>
    );
};

export default LibraryPage;
