import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import apiClient from "../lib/http";
import useToast from "./useToast";
import type {
    GetWorkspaceOwnerResponseDto,
    FindWorkspaceOwnerCandidateResponseDto,
    TransferWorkspaceOwnerResponseDto,
} from "@converge/shared";
import { isValidEmail } from "../utils/utils";

/**
 * Result of looking up the new owner's email: nothing to show yet, in
 * flight, a user who can take over, no account with that email (404), or
 * the caller's own address (409).
 */
export type OwnerCandidateLookup =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "found"; user: FindWorkspaceOwnerCandidateResponseDto }
    | { status: "notFound" }
    | { status: "isOwner" };

/**
 * State and actions for the workspace settings Ownership tab. Fetches the
 * current owner on mount. For the owner of a team workspace, typing a full
 * email looks up the new owner (debounced 300 ms), and the transfer runs
 * once the workspace name is typed to confirm.
 * @param workspaceId - the workspace being configured
 * @param workspaceName - the name that must be typed to confirm a transfer
 * @param canTransfer - whether the caller may transfer (owner of a team workspace)
 * @param onTransferred - called after a successful transfer, e.g. to reload the caller's role
 */
const useWorkspaceOwnerTab = ({
    workspaceId,
    workspaceName,
    canTransfer,
    onTransferred,
}: {
    workspaceId: number;
    workspaceName: string;
    canTransfer: boolean;
    onTransferred?: () => void;
}) => {
    const { showToast } = useToast();
    const [owner, setOwner] = useState<GetWorkspaceOwnerResponseDto | null>(
        null,
    ); // current workspace owner; null while loading or on error
    const [email, setEmail] = useState(""); // new owner's email
    const [lookupResult, setLookupResult] = useState<{
        email: string;
        lookup: OwnerCandidateLookup;
    } | null>(null); // latest settled lookup and the email it was for
    const [confirmText, setConfirmText] = useState(""); // workspace name typed to confirm
    const [isTransferring, setIsTransferring] = useState(false); // true while the transfer POST is in flight

    const trimmedEmail = email.trim();
    const canLookUp = canTransfer && isValidEmail(trimmedEmail); // a lookup runs only for the owner, once the address is complete
    // Derived: idle until the address is complete, loading until the lookup
    // for exactly this address settles.
    const lookup: OwnerCandidateLookup = !canLookUp
        ? { status: "idle" }
        : lookupResult?.email === trimmedEmail
          ? lookupResult.lookup
          : { status: "loading" };
    const isConfirmed = confirmText.trim() === workspaceName; // the typed name must match exactly
    const canSubmit =
        lookup.status === "found" && isConfirmed && !isTransferring;

    // Fetches the current owner on mount.
    useEffect(() => {
        const fetchOwner = async () => {
            try {
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
            }
        };
        fetchOwner();
    }, [workspaceId]);

    // Looks up the typed email 300 ms after typing stops, once it's a full
    // address. Results are stored with their email, so a stale response
    // never shows for a newer one.
    useEffect(() => {
        if (!canLookUp) return;

        const timeout = setTimeout(async () => {
            /** Stores the lookup's outcome for the email it was made for. */
            const settle = (lookup: OwnerCandidateLookup) =>
                setLookupResult({ email: trimmedEmail, lookup });
            try {
                const { data } =
                    await apiClient.get<FindWorkspaceOwnerCandidateResponseDto>(
                        `/workspaces/${workspaceId}/owner/find`,
                        { params: { email: trimmedEmail } },
                    );
                settle({ status: "found", user: data });
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) settle({ status: "notFound" });
                else if (status === 409) settle({ status: "isOwner" });
                else {
                    console.error("useWorkspaceOwnerTab: lookup failed:", err);
                    settle({ status: "idle" });
                }
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [workspaceId, trimmedEmail, canLookUp]);

    /**
     * Transfers ownership to the looked-up user via POST
     * /workspaces/:id/transfer-owner, then shows the new owner, clears the
     * form, and calls onTransferred. Failures are reported with a toast.
     */
    const transferOwner = async () => {
        if (!canSubmit || lookup.status !== "found") return;
        try {
            setIsTransferring(true);
            const { data } =
                await apiClient.post<TransferWorkspaceOwnerResponseDto>(
                    `/workspaces/${workspaceId}/transfer-owner`,
                    { newOwnerId: lookup.user.id },
                );
            setOwner(data);
            setEmail("");
            setConfirmText("");
            setLookupResult(null);
            showToast(`${data.name} now owns ${workspaceName}`);
            onTransferred?.();
        } catch (err) {
            console.error("useWorkspaceOwnerTab: transfer failed:", err);
            showToast("Couldn't transfer ownership", { tone: "error" });
        } finally {
            setIsTransferring(false);
        }
    };

    return {
        owner,
        email,
        setEmail,
        lookup,
        confirmText,
        setConfirmText,
        canSubmit,
        isTransferring,
        transferOwner,
    };
};

export default useWorkspaceOwnerTab;
