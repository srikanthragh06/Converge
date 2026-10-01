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
import TrashPage from "./pages/trash/TrashPage";
import useThemeSync from "./hooks/useThemeSync";
import AgentPanel from "./components/agentPanel/AgentPanel";
import RequireAuth from "./components/RequireAuth";
import AppShell from "./components/AppShell";

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
                {/* Signed-in pages share one auth gate and one app shell, which stay mounted across navigation */}
                <Route element={<RequireAuth />}>
                    <Route element={<AppShell />}>
                        <Route
                            path="/document/:documentId"
                            element={<EditorPage />}
                        />
                        <Route path="/library" element={<LibraryPage />} />
                        <Route path="/trash" element={<TrashPage />} />
                        <Route
                            path="/workspaces"
                            element={<WorkspacesPage />}
                        />
                        <Route path="/api-keys" element={<ApiKeysPage />} />
                        <Route path="/mcp-docs" element={<McpDocsPage />} />
                    </Route>
                </Route>
                <Route path="/" element={<Navigate to="/library" replace />} />
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
