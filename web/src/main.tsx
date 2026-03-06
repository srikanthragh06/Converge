import { createRoot } from "react-dom/client";
import { Provider } from "jotai";
import "./index.css"; // Tailwind base + utilities
import App from "./App";

// Jotai Provider wraps the whole app so all atoms are shared across hooks and components.
// Mount the React app into the #root div defined in index.html.
// The non-null assertion (!) is safe because index.html always has #root.
createRoot(document.getElementById("root")!).render(
    <Provider>
        <App />
    </Provider>,
);
