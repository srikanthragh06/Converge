import { Routes, Route } from "react-router-dom";
import EditorPage from "./pages/EditorPage";
import AuthPage from "./pages/AuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import NotFoundPage from "./pages/NotFoundPage";

// App defines the client-side route structure.
// /auth renders the Google sign-in page.
// /auth/callback handles the OAuth redirect from Google via Supabase.
// /note/:documentId renders the collaborative editor for that document.
// All other paths render the not-found page.
function App() {
    return (
        <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/note/:documentId" element={<EditorPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

export default App;
