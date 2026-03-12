// Top navigation bar: sync status indicator, ping display, offline badge, and Share button.
// "Restoring sync" takes priority over "Applying updates" when both are active.
// When the socket is disconnected, an offline badge replaces the ping indicator.
// The Share button is visible when the user is joined to a document (isDocJoined=true).
import { useState } from "react";
import { useAtomValue } from "jotai";
import {
    pingMsAtom,
    isRestoringSyncAtom,
    isApplyingUpdatesAtom,
    isSocketConnectedAtom,
} from "../atoms/uiAtoms";
import PingDot from "./PingDot";
import SyncStatus from "./SyncStatus";
import ShareModal from "./ShareModal";

export default function Navbar({
    isDocJoined = false,
    documentId,
}: {
    isDocJoined?: boolean;
    documentId?: number;
}) {
    const pingMs = useAtomValue(pingMsAtom);
    const isRestoring = useAtomValue(isRestoringSyncAtom);
    const isApplying = useAtomValue(isApplyingUpdatesAtom);
    const isSocketConnected = useAtomValue(isSocketConnectedAtom);

    // Local state for the Share modal — page-level concern, not a global atom.
    const [isShareOpen, setIsShareOpen] = useState(false);

    // "Restoring sync" takes priority over "Applying updates"
    let syncLabel: string | null = null;
    if (isRestoring) syncLabel = "Restoring sync";
    else if (isApplying) syncLabel = "Applying updates";

    return (
        <header className="h-14 border-b border-white/10 flex items-center px-6 shrink-0 bg-[#111111]">
            <div className="flex-1" />
            <div className="flex items-center gap-8">
                {/* Sync status — fades in/out with animated trailing dots */}
                <div className="mr-6">
                    <SyncStatus label={syncLabel} />
                </div>

                {/* Share button — only visible when joined to a document */}
                {isDocJoined && documentId !== undefined && (
                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                        Share
                    </button>
                )}

                {/* Offline badge replaces ping indicator when disconnected */}
                {!isSocketConnected ? (
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-zinc-500" />
                        <span className="text-sm text-zinc-500 whitespace-nowrap">
                            Offline
                        </span>
                    </div>
                ) : (
                    /* Ping indicator: colored dot + latency value */
                    <div className="flex items-center gap-4">
                        <PingDot pingMs={pingMs} />
                        <span className="text-sm text-white/40 tabular-nums whitespace-nowrap">
                            {pingMs !== null && `${pingMs} ms`}
                        </span>
                    </div>
                )}
            </div>

            {/* Share modal — rendered outside the flex row so it overlays correctly */}
            {documentId !== undefined && (
                <ShareModal
                    documentId={documentId}
                    isOpen={isShareOpen}
                    onClose={() => setIsShareOpen(false)}
                />
            )}
        </header>
    );
}
