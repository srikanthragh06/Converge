import { useMatch } from "react-router-dom";

/**
 * The id of the document open in the editor, or undefined on any other page
 * or when the URL's id isn't a number.
 *
 * Matches the URL directly rather than using `useParams`, which only sees
 * the params of the route it's called from, so this also works in the
 * sidebar, ⌘K and other app-shell code outside the editor route.
 */
const useDocumentId = () => {
    const match = useMatch("/document/:documentId");
    const raw = match?.params.documentId;
    return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
};

export default useDocumentId;
