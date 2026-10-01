import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { authAtom } from "@/atoms/auth";

/**
 * Seeds currentWorkspaceAtom from the auth response once the user is signed
 * in. Call it once, from a component that is always mounted with the sidebar —
 * not from the panel itself, which isn't mounted while the phone drawer is
 * closed, yet pages (e.g. Library) still need the workspace.
 */
const useSeedWorkspace = () => {
    const [currentWorkspace, setCurrentWorkspace] =
        useAtom(currentWorkspaceAtom);
    const auth = useAtomValue(authAtom);

    useEffect(() => {
        if (
            !currentWorkspace &&
            auth.status === "authenticated" &&
            auth.user?.selectedWorkspace
        ) {
            setCurrentWorkspace(auth.user.selectedWorkspace);
        }
    }, [auth.status, auth.user?.selectedWorkspace, setCurrentWorkspace]);
};

export default useSeedWorkspace;
