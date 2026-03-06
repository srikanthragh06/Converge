// Top navigation bar: Converge brand, sync status indicator, and ping display.
// "Restoring sync" takes priority over "Applying updates" when both are active.
import { useAtomValue } from "jotai";
import {
    pingMsAtom,
    isRestoringSyncAtom,
    isApplyingUpdatesAtom,
} from "../atoms/uiAtoms";
import PingDot from "./PingDot";
import SyncStatus from "./SyncStatus";

export default function Navbar() {
    const pingMs = useAtomValue(pingMsAtom);
    const isRestoring = useAtomValue(isRestoringSyncAtom);
    const isApplying = useAtomValue(isApplyingUpdatesAtom);

    // "Restoring sync" takes priority over "Applying updates"
    let syncLabel: string | null = null;
    if (isRestoring) syncLabel = "Restoring sync";
    else if (isApplying) syncLabel = "Applying updates";

    return (
        <header className="h-14 border-b border-white/10 flex items-center px-6 shrink-0 bg-[#111111]">
            {/* Brand */}
            <span className="text-2xl font-bold text-white font-[Inter,sans-serif]">
                Converge
            </span>

            <div className="flex-1" />
            <div className="flex items-center gap-8">
                {/* Sync status — fades in/out with animated trailing dots */}
                <div className="mr-6">
                    <SyncStatus label={syncLabel} />
                </div>

                {/* Ping indicator: colored dot + latency value */}
                <div className="flex items-center gap-4">
                    <PingDot pingMs={pingMs} />
                    <span className="text-sm text-white/40 tabular-nums whitespace-nowrap">
                        {pingMs !== null && `${pingMs} ms`}
                    </span>
                </div>
            </div>
        </header>
    );
}
