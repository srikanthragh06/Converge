// DocumentTitle: large bold title displayed above the editor. Editable only when isEditorOrAbove is true.
// Controlled input with immediate local state update on every keystroke.
// Debounces the PATCH call after the last keystroke so network traffic is minimal.
// Syncs from the server-loaded `title` prop whenever it changes (e.g. on reconnect).
// Last-writer-wins — no conflict resolution.

import { useEffect, useRef, useState } from "react";
import { axiosClient } from "../../lib/axiosClient";
import { ApiResponse, DocumentMetaData } from "../../types/api";

export default function DocumentTitle({
    documentId,
    title,
    isTitleSyncing,
    isEditorOrAbove,
}: {
    documentId: number;
    title: string;
    isTitleSyncing: boolean;
    isEditorOrAbove: boolean;
}) {
    // How long after the last keystroke before the PATCH fires (ms).
    const DEBOUNCE_MS = 250;
    // Maximum number of characters allowed in the title — must match server-side validation.
    const MAX_TITLE_LENGTH = 32;

    // Local controlled state — updates immediately on every keystroke so the UI is responsive.
    const [value, setValue] = useState(title);
    // True from the first keystroke until the PATCH resolves — drives the blur effect.
    const [isSaving, setIsSaving] = useState(false);
    // Debounce timer ref — reset on every keystroke, fires PATCH after DEBOUNCE_MS of silence.
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setValue(next);
        setIsSaving(true);

        // Reset the debounce window on every keystroke.
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                await axiosClient.patch<ApiResponse<DocumentMetaData>>(
                    `/documents/${documentId}/title`,
                    { title: next },
                );
            } catch (err) {
                console.error("Failed to save document title:", err);
            } finally {
                setIsSaving(false);
            }
        }, DEBOUNCE_MS);
    };

    // Sync local value when the server-loaded title prop changes (join / rejoin).
    useEffect(() => {
        setValue(title);
    }, [title]);

    // Cancel any pending debounce timer on unmount to avoid state updates on stale instances.
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    return (
        <div className="px-14 pt-8 pb-2">
            <input
                type="text"
                value={value}
                onChange={handleChange}
                placeholder="Untitled"
                disabled={!isEditorOrAbove}
                maxLength={MAX_TITLE_LENGTH}
                className={`w-full bg-transparent outline-none border-none text-6xl font-bold text-white placeholder-white/30 transition-opacity duration-300 rounded-lg ${
                    isSaving || isTitleSyncing
                        ? "opacity-80 cursor-default"
                        : "opacity-100"
                }`}
            />
        </div>
    );
}
