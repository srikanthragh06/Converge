import { Route, Routes } from "react-router-dom";
import DocPage from "./pages/doc/DocPage";

function App() {
    return (
        <div className="bg-zinc-900 text-white">
            <Routes>
                <Route path="/" element={<DocPage />} />
            </Routes>
        </div>
    );
}

export default App;
