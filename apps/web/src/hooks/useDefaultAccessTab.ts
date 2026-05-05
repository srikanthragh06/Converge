import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    DocumentAccessLevel,
    GetDocumentDefaultAccessResponseDto,
    SetDocumentDefaultAccessResponseDto,
} from "@converge/shared";

/**
 * Manages DefaultAccessTab state. Fetches the document's current default
 * access level on mount and exposes a setter that persists changes via PUT.
 */
const useDefaultAccessTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const [defaultAccess, setDefaultAccessState] =
        useState<DocumentAccessLevel | null>(null); // currently fetched default access level; null while loading
    const [isLoading, setIsLoading] = useState(false); // true while the initial GET fetch is in flight
    const [isSaving, setIsSaving] = useState(false); // true while a PUT request is in flight

    // Fetches the document's current default access level on mount.
    useEffect(() => {
        if (!documentId) return;

        const fetch = async () => {
            try {
                setIsLoading(true);
                const { data } =
                    await apiClient.get<GetDocumentDefaultAccessResponseDto>(
                        `/document/access/default/${documentId}`,
                    );
                setDefaultAccessState(data.defaultAccess);
            } catch (err) {
                console.error(
                    "useDefaultAccessTab: failed to fetch default access:",
                    err,
                );
            } finally {
                setIsLoading(false);
            }
        };

        fetch();
    }, [documentId]);

    /**
     * Persists a new default access level via PUT and updates local state on
     * success. Disables the dropdown for the duration of the request.
     */
    const updateDefaultAccess = async (newAccess: DocumentAccessLevel) => {
        if (!documentId) return;

        try {
            setIsSaving(true);
            const { data } =
                await apiClient.put<SetDocumentDefaultAccessResponseDto>(
                    `/document/access/default/${documentId}`,
                    { defaultAccess: newAccess },
                );
            setDefaultAccessState(data.defaultAccess);
        } catch (err) {
            console.error(
                "useDefaultAccessTab: failed to update default access:",
                err,
            );
        } finally {
            setIsSaving(false);
        }
    };

    return {
        defaultAccess,
        isLoading,
        isSaving,
        updateDefaultAccess,
    };
};

export default useDefaultAccessTab;
