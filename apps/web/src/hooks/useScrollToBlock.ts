import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { isSocketReadyAtom, syncStatusAtom } from "@/atoms/socket";

const OBSERVE_TIMEOUT_MS = 15000; // gives up waiting for the block to appear rather than leaking an observer forever on a stale/deleted blockId — generous since a long document can take a while to fully render, especially on an unminified dev build

/**
 * Scrolls to the block named by a `?blockId=` deep link (e.g. from an agent
 * chat citation), once. Fires on the genuine "restoring" -> not-"restoring"
 * edge, not just "currently not restoring": isSocketReady flips true one
 * render before useYjsSync's repair-sync effect actually sets isRestoring,
 * so there's a transient render where syncStatus is still null (not yet
 * "restoring") right after connect — reacting to that instead of the real
 * edge would fire before the doc has synced at all. Tracking the previous
 * syncStatus and requiring it to have actually been "restoring" avoids that.
 * Even the real edge only means the Yjs *data* has landed — BlockNote still
 * mounts each block as its own ProseMirror node view, which can paint a
 * render pass or two later, so a MutationObserver picks up the moment the
 * DOM node actually appears. Guarded per documentId so a later reconnect
 * (syncStatus cycling through "restoring" again mid-session) never
 * re-triggers it.
 */
const useScrollToBlock = (documentId: string | undefined) => {
    const [searchParams] = useSearchParams();
    const blockId = searchParams.get("blockId");

    const isSocketReady = useAtomValue(isSocketReadyAtom);
    const syncStatus = useAtomValue(syncStatusAtom);

    const scrolledForDocumentIdRef = useRef<string | undefined>(undefined); // the documentId this hook has already attempted a scroll for, if any
    const prevSyncStatusRef = useRef(syncStatus); // syncStatus as of the previous run, to detect the real "restoring" -> not-"restoring" edge

    useEffect(() => {
        const prevSyncStatus = prevSyncStatusRef.current;
        prevSyncStatusRef.current = syncStatus;

        const justFinishedRestoring =
            prevSyncStatus === "restoring" && syncStatus !== "restoring";

        if (!blockId || !documentId) return;
        if (!isSocketReady || !justFinishedRestoring) return;
        if (scrolledForDocumentIdRef.current === documentId) return;

        // Marked immediately, not just on success — a block that never
        // appears (stale/deleted blockId) should give up once, not retry on
        // every later syncStatus change for this same document.
        scrolledForDocumentIdRef.current = documentId;

        // CSS.escape guards against blockId containing characters that would
        // break the attribute selector — unlike BlockAwarenessOverlay's own
        // block ids (always BlockNote-generated), this one comes straight
        // from a URL query param.
        const selector = `[data-id="${CSS.escape(blockId)}"]`;

        const existing = document.querySelector(selector);
        if (existing) {
            existing.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        const observer = new MutationObserver(() => {
            const target = document.querySelector(selector);
            if (!target) return;
            observer.disconnect();
            target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const timeoutId = window.setTimeout(
            () => observer.disconnect(),
            OBSERVE_TIMEOUT_MS,
        );

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [blockId, documentId, isSocketReady, syncStatus]);
};

export default useScrollToBlock;
