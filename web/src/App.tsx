import { Routes, Route } from "react-router-dom";
import EditorPage from "./pages/EditorPage";
import NotFoundPage from "./pages/NotFoundPage";

// App defines the client-side route structure.
// /note/:documentId renders the collaborative editor for that document.
// All other paths render the not-found page.
function App() {
    return (
        <Routes>
            <Route path="/note/:documentId" element={<EditorPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

export default App;
