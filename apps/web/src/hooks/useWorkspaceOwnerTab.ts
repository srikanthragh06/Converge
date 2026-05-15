import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    GetWorkspaceOwnerResponseDto,
    FindWorkspaceOwnerCandidateResponseDto,
    TransferWorkspaceOwnerResponseDto,
    WorkspaceRole,
    WorkspaceType,
} from "@converge/shared";
import { isValidEmail } from "../utils/utils";

/**
 * Manages OwnerTab state for WorkspaceConfigModal. Fetches the workspace owner
 * and the caller's role on mount. When a valid email is typed (debounced 300 ms),
 * calls the owner-find endpoint to resolve a transfer candidate. Only the workspace
 * owner sees the transfer UI.
 */
const useWorkspaceOwnerTab = ({ workspaceId }: { workspaceId: number }) => {
    const [owner, setOwner] = useState<GetWorkspaceOwnerResponseDto | null>(
        null,
    ); // current workspace owner; null while loading or on error
    const [isOwnerLoading, setIsOwnerLoading] = useState(true); // true while the GET /owner fetch is in flight

    const [role, setRole] = useState<WorkspaceRole | null>(null); // caller's role in this workspace; null until loaded
    const [isRoleLoading, setIsRoleLoading] = useState(true); // true while the GET /my-role fetch is in flight

    const [workspaceType, setWorkspaceType] = useState<WorkspaceType | null>(
        null,
    ); // workspace type (personal vs custom); null until loaded
    const [isTypeLoading, setIsTypeLoading] = useState(true); // true while the GET /overview fetch is in flight

    const [email, setEmail] = useState(""); // email search query for the ownership transfer
    const [foundUser, setFoundUser] =
        useState<FindWorkspaceOwnerCandidateResponseDto | null>(null); // resolved transfer candidate; null when not found
    const [isFindLoading, setIsFindLoading] = useState(false); // true while the owner-find fetch is in flight
    const [isFindConflict, setIsFindConflict] = useState(false); // true when find returns 409 (email belongs to current owner)

    const [isTransferConfirmOpen, setIsTransferConfirmOpen] = useState(false); // true while the confirmation modal is open
    const [isTransferring, setIsTransferring] = useState(false); // true while the POST /transfer-owner request is in flight

    // Fetch the current owner on mount.
    useEffect(() => {
        const fetch = async () => {
            try {
                setIsOwnerLoading(true);
                const { data } =
                    await apiClient.get<GetWorkspaceOwnerResponseDto>(
                        `/workspaces/${workspaceId}/owner`,
                    );
                setOwner(data);
            } catch (err) {
                console.error(
                    "useWorkspaceOwnerTab: failed to fetch owner:",
                    err,
                );
            } finally {
                setIsOwnerLoading(false);
            }
        };
        fetch();
    }, [workspaceId]);

    // Fetch the caller's role and workspace type on mount.
    useEffect(() => {
        const fetchRole = async () => {
            try {
                const { data } = await apiClient.get<{ role: WorkspaceRole }>(
                    `/workspaces/${workspaceId}/my-role`,
                );
                setRole(data.role);
            } catch (err) {
                console.error(
                    "useWorkspaceOwnerTab: failed to fetch role:",
                    err,
                );
            } finally {
                setIsRoleLoading(false);
            }
        };

        const fetchType = async () => {
            try {
                const { data } = await apiClient.get<{ type: WorkspaceType }>(
                    `/workspaces/${workspaceId}/overview`,
                );
                setWorkspaceType(data.type);
            } catch (err) {
                console.error(
                    "useWorkspaceOwnerTab: failed to fetch workspace type:",
                    err,
                );
            } finally {
                setIsTypeLoading(false);
            }
        };

        fetchRole();
        fetchType();
    }, [workspaceId]);

    /** Calls GET /workspaces/:id/owner/find to resolve a transfer candidate by exact email. */
    const fetchFindCandidate = async (query: string) => {
        try {
            setIsFindLoading(true);
            setIsFindConflict(false);
            const { data } =
                await apiClient.get<FindWorkspaceOwnerCandidateResponseDto>(
                    `/workspaces/${workspaceId}/owner/find`,
                    { params: { email: query } },
                );
            setFoundUser(data);
        } catch (err: any) {
            setFoundUser(null);
            // 409 means the email belongs to the current owner.
            setIsFindConflict(err?.response?.status === 409);
        } finally {
            setIsFindLoading(false);
        }
    };

    /**
     * Transfers ownership to foundUser via POST /workspaces/:id/transfer-owner.
     * On success, updates the displayed owner and clears all search state.
     */
    const transferOwner = async () => {
        if (!foundUser) return;

        try {
            setIsTransferring(true);
            const { data } =
                await apiClient.post<TransferWorkspaceOwnerResponseDto>(
                    `/workspaces/${workspaceId}/transfer-owner`,
                    { newOwnerId: foundUser.id },
                );
            setOwner(data);
            setFoundUser(null);
            setEmail("");
            setIsTransferConfirmOpen(false);
        } catch (err) {
            console.error(
                "useWorkspaceOwnerTab: failed to transfer ownership:",
                err,
            );
        } finally {
            setIsTransferring(false);
        }
    };

    // Resets find state when email is cleared; debounces 300 ms then fires the
    // find endpoint when a valid email address is entered.
    useEffect(() => {
        if (email.trim() === "") {
            setFoundUser(null);
            setIsFindConflict(false);
            return;
        }

        const timeout = setTimeout(() => {
            setIsFindConflict(false);
            if (isValidEmail(email.trim())) fetchFindCandidate(email.trim());
        }, 300);

        return () => clearTimeout(timeout);
    }, [email]);

    const isOwner = role === "owner"; // true when the caller may initiate a transfer
    const isPersonal = workspaceType === "personal"; // true for personal workspaces where transfer is blocked

    return {
        owner,
        isOwnerLoading,
        isRoleLoading,
        isTypeLoading,
        isOwner,
        isPersonal,
        email,
        setEmail,
        foundUser,
        isFindLoading,
        isFindConflict,
        isTransferConfirmOpen,
        setIsTransferConfirmOpen,
        isTransferring,
        transferOwner,
    };
};

export default useWorkspaceOwnerTab;
