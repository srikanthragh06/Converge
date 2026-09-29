import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { authAtom } from "../../atoms/auth";
import { isAgentPanelOpenAtom } from "../../atoms/agent";
import AgentPanelDialog from "./AgentPanelDialog";

/**
 * Mounts the Ask Converge side panel once for the whole app (in App, outside
 * the routes), so its conversation and any streaming reply survive page
 * navigation, e.g. following a document link from an answer. Nothing is
 * mounted, and no conversations are fetched, until the panel is first
 * opened; after that it stays mounted while closed, so reopening it (⌘J)
 * shows the same conversation, and a reply keeps streaming in the background.
 */
const AgentPanel = () => {
    const auth = useAtomValue(authAtom); // the panel exists only for a signed-in user
    const [isOpen, setIsOpen] = useAtom(isAgentPanelOpenAtom); // opened by ⌘J, the sidebar, or /agent
    const [hasOpened, setHasOpened] = useState(false); // true once the panel has been opened in this session

    // Marks the first open during render, so the dialog mounts in the same pass.
    if (isOpen && !hasOpened) setHasOpened(true);

    if (auth.status !== "authenticated" || !hasOpened) return null;
    return <AgentPanelDialog open={isOpen} onClose={() => setIsOpen(false)} />;
};

export default AgentPanel;
