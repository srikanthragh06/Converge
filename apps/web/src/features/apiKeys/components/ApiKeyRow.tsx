import { LuKeyRound } from "react-icons/lu";
import type { ApiKeyDto } from "@converge/shared";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RowActions, TableCell, TableRow } from "@/components/common/Table";

/**
 * Relative time with a leading capital ("Just now", "10m ago"), or "Never".
 * @param date - the time to describe, or null if it never happened
 */
const formatWhen = (date: Date | null) => {
    if (!date) return "Never";
    const text = timeAgo(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * One row of an API keys table (pp 33 / 41): name with a key icon, key
 * prefix in mono, created, and last used. An active key reveals a red
 * Revoke button on hover (always shown on touch screens); a revoked key is
 * dimmed and struck through, with a Revoked badge. Below 1024px (phones, tablets) the prefix and
 * last use move under the name.
 * @param apiKey - the key
 * @param onRevoke - opens the revoke confirmation; omitted for revoked keys
 */
const ApiKeyRow = ({
    apiKey,
    onRevoke,
}: {
    apiKey: ApiKeyDto;
    onRevoke?: () => void;
}) => {
    const isRevoked = apiKey.revokedAt !== null;

    return (
        <TableRow className={cn(isRevoked ? "min-h-11" : "min-h-[3.75rem]")}>
            <TableCell className="gap-3">
                <LuKeyRound
                    className={cn(
                        "h-4 w-4 shrink-0",
                        isRevoked ? "text-fg-muted" : "text-gold",
                    )}
                />
                <div className="flex min-w-0 flex-col">
                    <span
                        className={cn(
                            "truncate",
                            isRevoked
                                ? "text-fg-muted line-through"
                                : "text-base text-fg",
                        )}
                    >
                        {apiKey.label}
                    </span>
                    <span className="truncate font-mono text-xs text-fg-muted lg:hidden">
                        {apiKey.keyPrefix}… · used{" "}
                        {formatWhen(apiKey.lastUsedAt).toLowerCase()}
                    </span>
                </div>
            </TableCell>
            <TableCell
                hideOnMobile
                className="font-mono text-[13px] text-fg-muted"
            >
                <span className="truncate">{apiKey.keyPrefix}…</span>
            </TableCell>
            <TableCell hideOnMobile className="text-fg-muted">
                {formatWhen(apiKey.createdAt)}
            </TableCell>
            <TableCell hideOnMobile className="text-fg-muted">
                {formatWhen(apiKey.lastUsedAt)}
            </TableCell>
            {isRevoked ? (
                <div className="flex justify-end">
                    <Badge variant="danger">Revoked</Badge>
                </div>
            ) : (
                <RowActions>
                    <Button
                        variant="destructive-outline"
                        size="sm"
                        onClick={onRevoke}
                        className="sm:h-8 sm:px-3 sm:text-sm"
                    >
                        Revoke
                    </Button>
                </RowActions>
            )}
        </TableRow>
    );
};

export default ApiKeyRow;
