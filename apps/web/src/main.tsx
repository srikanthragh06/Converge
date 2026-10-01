import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { BrowserRouter } from "react-router-dom";
import { injectThemeVariables } from "./theme/themeVariables";
import { TooltipProvider } from "./components/ui/Tooltip";
import Toaster from "./components/ui/Toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient";

injectThemeVariables();

createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <TooltipProvider>
                <App />
                <Toaster />
            </TooltipProvider>
        </BrowserRouter>
        <ReactQueryDevtools />
    </QueryClientProvider>,
);
