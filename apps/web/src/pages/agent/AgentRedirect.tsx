import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { isAgentPanelOpenAtom } from "../../atoms/agent";

/**
 * What the old /agent URL does now that Ask Converge is a side panel rather
 * than a page: opens the panel over Library, replacing /agent in history so
 * Back doesn't land on it again. Keeps old bookmarks and links working.
 */
const AgentRedirect = () => {
    const setIsAgentPanelOpen = useSetAtom(isAgentPanelOpenAtom); // opens the Ask Converge panel

    // Opens the panel once, alongside the redirect below.
    useEffect(() => {
        setIsAgentPanelOpen(true);
    }, [setIsAgentPanelOpen]);

    return <Navigate to="/library" replace />;
};

export default AgentRedirect;
