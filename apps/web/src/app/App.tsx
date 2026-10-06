import { Navigate, Route, Routes } from "react-router-dom";
import EditorPage from "@/features/editor/EditorPage";
import LibraryPage from "@/features/documents/library/LibraryPage";
import useAuth from "@/features/auth/hooks/useAuth";
import AuthPage from "@/features/auth/AuthPage";
import NotFoundPage from "./NotFoundPage";
import AuthCallbackPage from "@/features/auth/AuthCallbackPage";
import WorkspacesPage from "@/features/workspaces/WorkspacesPage";
import ApiKeysPage from "@/features/apiKeys/ApiKeysPage";
import McpDocsPage from "@/features/mcpDocs/McpDocsPage";
import TrashPage from "@/features/documents/trash/TrashPage";
import useThemeSync from "@/hooks/useThemeSync";
import AgentPanel from "@/features/agent/AgentPanel";
import RequireAuth from "./RequireAuth";
import AppShell from "./AppShell";

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
