import { Route, Routes } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import useSocket from "./hooks/useSocket";

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
            </Routes>
        </div>
    );
}

export default App;
