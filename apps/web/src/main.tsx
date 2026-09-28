import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { injectThemeVariables } from "./theme/themeVariables";
import { TooltipProvider } from "./components/ui/Tooltip";
import Toaster from "./components/ui/Toaster";

injectThemeVariables();

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <TooltipProvider>
            <App />
            <Toaster />
        </TooltipProvider>
    </BrowserRouter>,
);
