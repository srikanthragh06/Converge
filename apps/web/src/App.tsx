import { Navigate, Route, Routes } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import LibraryPage from "./pages/library/LibraryPage";
import useAuth from "./hooks/useAuth";
import AuthPage from "./pages/auth/AuthPage";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import AuthCallbackPage from "./pages/authCallback/AuthCallbackPage";
import WorkspacesPage from "./pages/workspaces/WorkspacesPage";
import ApiKeysPage from "./pages/apiKeys/ApiKeysPage";
import McpDocsPage from "./pages/mcpDocs/McpDocsPage";
import AgentPage from "./pages/agent/AgentPage";
import useThemeSync from "./hooks/useThemeSync";
import AgentPanel from "./components/agentPanel/AgentPanel";

/**
 * Root application component. Hydrates auth state, keeps the active color
 * theme applied, and renders the top-level route tree.
 */
function App() {
    useAuth(); // hydrate auth state from the server cookie on first load
    useThemeSync(); // keep <html data-theme> in sync with themeAtom

    return (
        <div className="bg-surface text-fg">
            <Routes>
                <Route path="/document/:documentId" element={<EditorPage />} />
                <Route
                    path="/library"
                    element={<LibraryPage key="library" />}
                />
                {/* Interim: Library's Trash tab, until Trash gets its own page (redesign 9.2) */}
                <Route
                    path="/trash"
                    element={<LibraryPage key="trash" initialView="trash" />}
                />
                <Route path="/" element={<Navigate to="/library" replace />} />
                <Route path="/workspaces" element={<WorkspacesPage />} />
                <Route path="/api-keys" element={<ApiKeysPage />} />
                <Route path="/mcp-docs" element={<McpDocsPage />} />
                <Route path="/agent" element={<AgentPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
            {/* Ask Converge, mounted outside the routes so a conversation survives navigation */}
            <AgentPanel />
        </div>
    );
}

export default App;
