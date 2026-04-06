import { Route, Routes } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import useSocket from "./hooks/useSocket";
import AuthPage from "./pages/auth/AuthPage";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import AuthCallbackPage from "./pages/authCallback/AuthCallback";

/**
 * Root application component. Initialises the socket connection and
 * renders the top-level route tree.
 */
function App() {
    useSocket(); // initialise the Socket.io connection for the lifetime of the app

    return (
        <div className="bg-background-base text-text-primary">
            <Routes>
                <Route path="/" element={<EditorPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </div>
    );
}

export default App;
