import { Route, Routes } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import LibraryPage from "./pages/library/LibraryPage";
import useAuth from "./hooks/useAuth";
import AuthPage from "./pages/auth/AuthPage";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import AuthCallbackPage from "./pages/authCallback/AuthCallbackPage";

/**
 * Root application component. Hydrates auth state and renders the top-level route tree.
 */
function App() {
    useAuth(); // hydrate auth state from the server cookie on first load

    return (
        <div className="bg-background-base text-text-primary">
            <Routes>
                <Route path="/document/:documentId" element={<EditorPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/" element={<LibraryPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </div>
    );
}

export default App;
