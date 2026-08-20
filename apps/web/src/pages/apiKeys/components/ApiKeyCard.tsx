import { MdVpnKey } from "react-icons/md";
import type { ApiKeyDto } from "@converge/shared";
import { timeAgo } from "../../../utils/utils";

/**
 * A single API key card showing its label, key prefix, revoked status,
 * and last-used/created timestamps. No revoke action yet.
 */
const ApiKeyCard = ({ apiKey }: { apiKey: ApiKeyDto }) => {
    const isRevoked = apiKey.revokedAt !== null;

    return (
        <div
            className={`flex items-start sm:px-4 sm:py-3 py-2 px-3
            rounded-lg bg-background
            transition w-11/12 sm:w-[600px] gap-3
            ${isRevoked ? "opacity-50" : "hover:opacity-85"}`}
        >
            <MdVpnKey className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />
            <div className="flex flex-col space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium sm:text-base text-sm truncate">
                        {apiKey.label}
                    </span>
                    {isRevoked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium shrink-0">
                            Revoked
                        </span>
                    )}
                </div>
                <code className="text-xs opacity-50">{apiKey.keyPrefix}…</code>
                <div className="flex flex-col space-y-0.5">
                    <span className="text-xs opacity-40">
                        Created {timeAgo(apiKey.createdAt)}
                    </span>
                    <span className="text-xs opacity-40">
                        {apiKey.lastUsedAt
                            ? `Last used ${timeAgo(apiKey.lastUsedAt)}`
                            : "Never used"}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyCard;
