// Top navigation bar: sync status indicator, ping display, and offline badge.
// "Restoring sync" takes priority over "Applying updates" when both are active.
// When the socket is disconnected, an offline badge replaces the ping indicator.
import { useAtomValue } from "jotai";
import {
    pingMsAtom,
    isRestoringSyncAtom,
    isApplyingUpdatesAtom,
    isSocketConnectedAtom,
} from "../atoms/uiAtoms";
import PingDot from "./PingDot";
import SyncStatus from "./SyncStatus";

export default function Navbar() {
    const pingMs = useAtomValue(pingMsAtom);
    const isRestoring = useAtomValue(isRestoringSyncAtom);
    const isApplying = useAtomValue(isApplyingUpdatesAtom);
    const isSocketConnected = useAtomValue(isSocketConnectedAtom);

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
        </header>
    );
}
