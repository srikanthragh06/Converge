import { Route, Routes } from "react-router-dom";
import DocPage from "./pages/doc/DocPage";

function App() {
    return (
        <div className="bg-[#171717] text-white">
            <Routes>
                <Route path="/" element={<DocPage />} />
            </Routes>
        </div>
    );
}

export default App;
