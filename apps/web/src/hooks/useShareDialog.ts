import { useCallback, useEffect, useRef, useState } from "react";
import type {
    DocumentAccessLevel,
    DocumentAccessUserDto,
    FindNewDocumentAccessUserResponseDto,
    GetDocumentAccessResponseDto,
    GetDocumentOverviewResponseDto,
    GetDocumentResponseDto,
    GetDocumentRoleOverridesResponseDto,
    ResolvedDocumentAccessLevel,
    UpdateDocumentRoleOverridesResponseDto,
} from "@converge/shared";
import { isAxiosError } from "axios";
import apiClient from "../lib/http";
import { hasAccess, isValidEmail } from "../utils/utils";
import useToast from "./useToast";

/** Page size of the people-with-access list. */
const ACCESS_LIST_LIMIT = 20;

/** A per-role override field on the document. */
export type RoleOverrideField =
    | "adminDocAccess"
    | "memberDocAccess"
    | "nonMemberDocAccess";

/**
 * Result of looking up the typed email: nothing to show yet, in flight, a
 * user who can be added, no account with that email (404), or someone who
 * is already the owner or has direct access (409).
 */
export type EmailLookup =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "found"; user: FindNewDocumentAccessUserResponseDto }
    | { status: "notFound" }
    | { status: "hasAccess" };

/**
 * State and actions for the Share dialog. On mount fetches, in parallel, the
 * caller's resolved access, the document owner (from the overview endpoint —
 * the workspace owner never has an access row), the per-role overrides, and
 * the first page of people with direct access; later pages load when the
 * list's sentinel scrolls into view. Typing a full email looks the person
 * up (debounced) so they can be added with a chosen level.
 * @param documentId - the document being shared
 */
const useShareDialog = (documentId: string | undefined) => {
    const [callerAccess, setCallerAccess] =
        useState<ResolvedDocumentAccessLevel | null>(null); // caller's resolved access; null while loading or on error
    const [owner, setOwner] = useState<{
        name: string;
        email: string;
    } | null>(null); // workspace owner, shown as the list's first row
    const [roleOverrides, setRoleOverrides] =
        useState<GetDocumentRoleOverridesResponseDto | null>(null); // per-role overrides + workspace defaults; null while loading
    const [savingRole, setSavingRole] = useState<RoleOverrideField | null>(
        null,
    ); // role whose override PUT is in flight
    const [people, setPeople] = useState<DocumentAccessUserDto[]>([]); // people with direct access, accumulated across pages
    const [pendingUserId, setPendingUserId] = useState<number | null>(null); // person whose access change is in flight
    const [isInitialLoading, setIsInitialLoading] = useState(true); // true until the mount fetches settle
    const [isFetchingMore, setIsFetchingMore] = useState(false); // true while a later page is loading
    const [email, setEmail] = useState(""); // text in the "Add people by email" field
    const [lookupResult, setLookupResult] = useState<{
        email: string;
        lookup: EmailLookup;
    } | null>(null); // latest settled lookup and the email it was for
    const [isAdding, setIsAdding] = useState(false); // true while the add PUT is in flight
    const { showToast } = useToast(); // reports failed writes

    const canManage = callerAccess !== null && hasAccess(callerAccess, "admin"); // admins and above may add people and change access

    const nextCursorRef = useRef<number | null>(null); // keyset cursor for the next page; null when there are no more
    const isFetchingMoreRef = useRef(false); // guards loadMore against overlapping calls without re-creating it
    const trimmedEmail = email.trim(); // the typed email without stray spaces
    const canLookUp = canManage && isValidEmail(trimmedEmail); // a lookup runs only for admins, once the address is complete
    // Derived: idle until the address is complete, loading until the lookup
    // for exactly this address settles.
    const lookup: EmailLookup = !canLookUp
        ? { status: "idle" }
        : lookupResult?.email === trimmedEmail
          ? lookupResult.lookup
          : { status: "loading" };

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref for the sentinel at the end of the people list.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    // Loads everything the dialog shows on open.
    useEffect(() => {
        if (!documentId) return;

        /** Fetches the caller's resolved access, which gates every control. */
        const fetchCallerAccess = async () => {
            try {
                const { data } = await apiClient.get<GetDocumentResponseDto>(
                    `/document/id/${documentId}`,
                );
                setCallerAccess(data.resolvedAccess);
            } catch (err) {
                console.error("useShareDialog: failed to fetch access:", err);
            }
        };

        /** Fetches the owner's name and email from the document overview. */
        const fetchOwner = async () => {
            try {
                const { data } =
                    await apiClient.get<GetDocumentOverviewResponseDto>(
                        `/document/${documentId}/overview`,
                    );
                setOwner({ name: data.ownerName, email: data.ownerEmail });
            } catch (err) {
                console.error("useShareDialog: failed to fetch owner:", err);
            }
        };

        /** Fetches the per-role overrides with the workspace defaults. */
        const fetchRoleOverrides = async () => {
            try {
                const { data } =
                    await apiClient.get<GetDocumentRoleOverridesResponseDto>(
                        `/document-access/${documentId}/role-overrides`,
                    );
                setRoleOverrides(data);
            } catch (err) {
                console.error(
                    "useShareDialog: failed to fetch role overrides:",
                    err,
                );
            }
        };

        /** Fetches the first page of people with direct access. */
        const fetchPeople = async () => {
            try {
                const { data } =
                    await apiClient.get<GetDocumentAccessResponseDto>(
                        `/document-access/${documentId}`,
                        { params: { limit: ACCESS_LIST_LIMIT } },
                    );
                setPeople(data.users);
                nextCursorRef.current = data.nextCursor;
            } catch (err) {
                console.error("useShareDialog: failed to fetch people:", err);
            }
        };

        Promise.all([
            fetchCallerAccess(),
            fetchOwner(),
            fetchRoleOverrides(),
            fetchPeople(),
        ]).finally(() => setIsInitialLoading(false));
    }, [documentId]);

    /** Appends the next page of people. No-ops while loading or on the last page. */
    const loadMore = useCallback(async () => {
        if (
            !documentId ||
            isFetchingMoreRef.current ||
            nextCursorRef.current === null
        )
            return;
        try {
            isFetchingMoreRef.current = true;
            setIsFetchingMore(true);
            const { data } = await apiClient.get<GetDocumentAccessResponseDto>(
                `/document-access/${documentId}`,
                {
                    params: {
                        limit: ACCESS_LIST_LIMIT,
                        cursorId: nextCursorRef.current,
                    },
                },
            );
            // Skip anyone already in the list, e.g. a person added in this session.
            setPeople((prev) => [
                ...prev,
                ...data.users.filter((u) => !prev.some((p) => p.id === u.id)),
            ]);
            nextCursorRef.current = data.nextCursor;
        } catch (err) {
            console.error("useShareDialog: failed to load more people:", err);
        } finally {
            isFetchingMoreRef.current = false;
            setIsFetchingMore(false);
        }
    }, [documentId]);

    // Loads the next page whenever the sentinel scrolls into view.
    useEffect(() => {
        if (!sentinelEl) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) loadMore();
            },
            { threshold: 0.1 },
        );
        observer.observe(sentinelEl);
        return () => observer.disconnect();
    }, [sentinelEl, loadMore]);

    // Looks up the typed email 300ms after typing stops, once it's a full
    // address; admins only, since only they can add people. Results are
    // stored with their email, so a stale response never shows for a newer one.
    useEffect(() => {
        if (!documentId || !canLookUp) return;

        const timeout = setTimeout(async () => {
            /** Stores the lookup's outcome for the email it was made for. */
            const settle = (lookup: EmailLookup) =>
                setLookupResult({ email: trimmedEmail, lookup });
            try {
                const { data } =
                    await apiClient.get<FindNewDocumentAccessUserResponseDto>(
                        `/document-access/${documentId}/find-new`,
                        { params: { email: trimmedEmail } },
                    );
                settle({ status: "found", user: data });
            } catch (err) {
                const status = isAxiosError(err)
                    ? err.response?.status
                    : undefined;
                if (status === 404) settle({ status: "notFound" });
                else if (status === 409) settle({ status: "hasAccess" });
                else {
                    console.error("useShareDialog: email lookup failed:", err);
                    settle({ status: "idle" });
                }
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [documentId, trimmedEmail, canLookUp]);

    /**
     * Gives the looked-up person direct access, then moves them into the
     * people list and clears the field.
     * @param access - the level chosen in the add card
     */
    const addPerson = async (access: DocumentAccessLevel) => {
        if (!documentId || lookup.status !== "found") return;
        const user = lookup.user;
        try {
            setIsAdding(true);
            await apiClient.put(
                `/document-access/${documentId}/user/${user.id}`,
                { access },
            );
            setPeople((prev) => [
                { ...user, access },
                ...prev.filter((p) => p.id !== user.id),
            ]);
            setEmail("");
            setLookupResult(null); // they have access now, so an old "found" result is stale
        } catch (err) {
            console.error("useShareDialog: failed to add person:", err);
            showToast(`Couldn't add ${user.name}`, { tone: "error" });
        } finally {
            setIsAdding(false);
        }
    };

    /**
     * Changes a person's direct access level.
     * @param userId - the person whose access changes
     * @param access - the new level
     */
    const changePersonAccess = async (
        userId: number,
        access: DocumentAccessLevel,
    ) => {
        if (!documentId) return;
        try {
            setPendingUserId(userId);
            await apiClient.put(
                `/document-access/${documentId}/user/${userId}`,
                { access },
            );
            setPeople((prev) =>
                prev.map((p) => (p.id === userId ? { ...p, access } : p)),
            );
        } catch (err) {
            console.error("useShareDialog: failed to change access:", err);
            showToast("Couldn't change their access", { tone: "error" });
        } finally {
            setPendingUserId(null);
        }
    };

    /**
     * Removes a person's direct access, so they fall back to their role's
     * general access.
     * @param userId - the person to remove
     */
    const removePerson = async (userId: number) => {
        if (!documentId) return;
        try {
            setPendingUserId(userId);
            await apiClient.delete(
                `/document-access/${documentId}/user/${userId}`,
            );
            setPeople((prev) => prev.filter((p) => p.id !== userId));
        } catch (err) {
            console.error("useShareDialog: failed to remove access:", err);
            showToast("Couldn't remove their access", { tone: "error" });
        } finally {
            setPendingUserId(null);
        }
    };

    /**
     * Sets or resets one role's override. Null resets the role to the
     * workspace default.
     * @param field - which role's override to change
     * @param value - the new level, or null for the workspace default
     */
    const updateRoleOverride = async (
        field: RoleOverrideField,
        value: DocumentAccessLevel | null,
    ) => {
        if (!documentId) return;
        try {
            setSavingRole(field);
            const { data } =
                await apiClient.put<UpdateDocumentRoleOverridesResponseDto>(
                    `/document-access/${documentId}/role-overrides`,
                    { [field]: value },
                );
            setRoleOverrides((prev) => (prev ? { ...prev, ...data } : prev));
        } catch (err) {
            console.error(
                "useShareDialog: failed to update role override:",
                err,
            );
            showToast("Couldn't change general access", { tone: "error" });
        } finally {
            setSavingRole(null);
        }
    };

    return {
        callerAccess,
        canManage,
        owner,
        roleOverrides,
        savingRole,
        updateRoleOverride,
        people,
        pendingUserId,
        changePersonAccess,
        removePerson,
        isInitialLoading,
        isFetchingMore,
        sentinelRef,
        email,
        setEmail,
        lookup,
        isAdding,
        addPerson,
    };
};

export default useShareDialog;
