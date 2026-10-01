import { useState } from "react";
import { isAxiosError } from "axios";
import useDocument from "./useDocument";

/**
 * Loads the open document through the shared useDocument query and turns
 * the result into the editor's status: loading, ready, forbidden (a 403), or
 * notFound (a 404 or any other failure, which EditorPage sends to /404). A
 * document already loaded stays ready even if a background refresh fails.
 * Seeds the title via setTitle once per document; after that, title changes
 * arrive over the socket.
 * @param documentId - the open document, or undefined when the URL's id isn't a number (reported as notFound)
 * @param setTitle - setter from useDocumentTitle used to seed the title from the server response
 */
const useDocumentFetch = (
    documentId: number | undefined,
    setTitle: React.Dispatch<React.SetStateAction<string>>,
) => {
    const { document, error } = useDocument(documentId);
    const [seededId, setSeededId] = useState<number | null>(null); // document whose title was last seeded

    // Seeds the title during render (rather than in an effect) the first
    // time each document's data arrives.
    if (document && document.id !== seededId) {
        setSeededId(document.id);
        setTitle(document.title);
    }

    const documentStatus =
        documentId === undefined
            ? ("notFound" as const)
            : document
              ? ("ready" as const)
              : !error
                ? ("loading" as const)
                : isAxiosError(error) && error.response?.status === 403
                  ? ("forbidden" as const)
                  : ("notFound" as const);

    return {
        documentStatus,
        documentAccess: document?.resolvedAccess ?? null, // resolved access level for the current user on this document
        docWorkspace: document?.workspace ?? null, // workspace the document belongs to; null while loading or on error
        isPinned: document?.isPinned ?? false, // whether the user has pinned the document
    };
};

export default useDocumentFetch;
