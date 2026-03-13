import { Routes, Route } from "react-router-dom";
import EditorPage from "./pages/EditorPage";
import AuthPage from "./pages/AuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import LibraryPage from "./pages/LibraryPage";
import NotFoundPage from "./pages/NotFoundPage";
import useAuth from "./hooks/useAuth";
import useSocket from "./hooks/useSocket";

// App defines the client-side route structure.
// useAuth and useSocket are app-level hooks — auth is checked on every mount
// and the socket lifecycle is tied to the whole app, not individual pages.
// /auth renders the Google sign-in page.
// /auth/callback handles the OAuth redirect from Google via Supabase.
// /library renders the document library (user's viewed documents + search).
// /note/:documentId renders the collaborative editor for that document.
// All other paths render the not-found page.
// DocSearchOverlay and its Ctrl+P shortcut are scoped to EditorPage.
function App() {
    // Verify JWT cookie via /auth/me on mount — sets isAuthedAtom / currentUserAtom
    // or redirects to /auth if unauthenticated.
    useAuth();

    // Connect the socket only after isAuthedAtom is true.
    useSocket();

    return (
        <>
            <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/note/:documentId" element={<EditorPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </>
    );
}

export default App;
