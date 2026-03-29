import { Route, Routes } from "react-router-dom";
import EditorPage from "./pages/editor/EditorPage";
import useSocket from "./hooks/useSocket";

function App() {
    useSocket();

    return (
        <div className="bg-background-base text-text-primary">
            <Routes>
                <Route path="/" element={<EditorPage />} />
            </Routes>
        </div>
    );
}

export default App;
