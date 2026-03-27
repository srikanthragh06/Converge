import { Route, Routes } from "react-router-dom";
import DocPage from "./pages/doc/DocPage";

function App() {
    return (
        <div className="bg-background-base text-text-primary">
            <Routes>
                <Route path="/" element={<DocPage />} />
            </Routes>
        </div>
    );
}

export default App;
