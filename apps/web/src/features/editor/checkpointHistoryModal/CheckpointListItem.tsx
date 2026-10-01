import type { DocumentCheckpointDto } from "@converge/shared";
import { Avatar, AvatarGroup } from "@/components/common/Avatar";
import Tooltip from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";

/** Maximum number of contributor avatars shown before the rest are collapsed (still counted in the tooltip). */
const MAX_VISIBLE_CONTRIBUTOR_AVATARS = 4;
/** Maximum number of contributor names spelled out inline before collapsing to "and many others". */
const MAX_NAMED_CONTRIBUTORS = 3;

/**
 * Formats a checkpoint time as in the mockups: "Sep 28, 2026 · 1:47 a.m.".
 * @param date - the checkpoint's last-edited time
 */
const formatCheckpointTime = (date: Date | string): string => {
    const d = new Date(date);
    const day = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const time = d
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        .replace(/\bAM\b/, "a.m.")
        .replace(/\bPM\b/, "p.m.");
    return `${day} · ${time}`;
};

/**
 * Formats contributor names for inline display: every name joined with
 * commas and a trailing "and" for up to MAX_NAMED_CONTRIBUTORS people; past
 * that, the first MAX_NAMED_CONTRIBUTORS names followed by "and many
 * others" rather than an exact remaining count.
 * @param names - contributor names in display order
 * @returns the formatted inline string, or "" if names is empty
 */
const formatContributorNames = (names: string[]): string => {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length <= MAX_NAMED_CONTRIBUTORS) {
        return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    }
    return `${names.slice(0, MAX_NAMED_CONTRIBUTORS).join(", ")} and many others`;
};

/**
 * One row in the checkpoint history list (pp 50 / 56). First line shows
 * lastEditedAt — the timestamp of the actual last edit folded into this
 * checkpoint, not createdAt (when the checkpoint row itself was inserted,
 * which can lag behind for automatic checkpoints) — and a Manual / Auto /
 * "Before AI edit" badge derived from the checkpoint's source. Second line
 * shows a stacked-avatar contributor summary — up to
 * MAX_VISIBLE_CONTRIBUTOR_AVATARS avatars, and inline names capped
 * separately at MAX_NAMED_CONTRIBUTORS. Hovering the avatar stack shows every
 * contributor's name, including ones collapsed out of both caps. Clicking the
 * row selects it; the selected row gets the selected fill, a gold left bar,
 * and a bold timestamp.
 */
const CheckpointListItem = ({
    checkpoint,
    isSelected,
    onSelect,
}: {
    checkpoint: DocumentCheckpointDto;
    /** Whether this checkpoint is the one currently selected in the list. */
    isSelected: boolean;
    /** Called when the user clicks this row. */
    onSelect: () => void;
}) => {
    const visibleContributors = checkpoint.contributors.slice(
        0,
        MAX_VISIBLE_CONTRIBUTOR_AVATARS,
    ); // avatars rendered explicitly
    const names = checkpoint.contributors.map((c) => c.name); // full contributor name list, used for both the inline summary and the tooltip

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                onSelect();
            }}
            aria-current={isSelected}
            className={`relative flex w-full min-w-0 cursor-pointer flex-col gap-2 px-4 py-3.5 outline-none transition-colors focus-visible:bg-surface-hover ${
                isSelected ? "bg-surface-selected" : "hover:bg-surface-hover"
            }`}
        >
            {isSelected && (
                <span className="absolute inset-y-0 left-0 w-[3px] bg-gold" />
            )}
            {/* Row 1: last-edited time (left) and Manual/Auto/"Before AI edit" source badge (right) */}
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`truncate text-sm text-fg ${isSelected ? "font-semibold" : ""}`}
                >
                    {formatCheckpointTime(checkpoint.lastEditedAt)}
                </span>
                <Badge className={isSelected ? "bg-transparent" : ""}>
                    {checkpoint.source === "manual"
                        ? "Manual"
                        : checkpoint.source === "mcp"
                          ? "Before AI edit"
                          : "Auto"}
                </Badge>
            </div>
            {/* Row 2: stacked contributor avatars + names, only rendered if there are any contributors */}
            {checkpoint.contributors.length > 0 && (
                <div className="flex min-w-0 items-center gap-2">
                    <Tooltip
                        side="top"
                        content={checkpoint.contributors.map((c) => (
                            <p key={c.id}>{c.name}</p>
                        ))}
                    >
                        <AvatarGroup
                            className="shrink-0"
                            ringClassName={
                                isSelected
                                    ? "[&>*]:ring-surface-selected"
                                    : "[&>*]:ring-surface-elevated"
                            }
                        >
                            {visibleContributors.map((c) => (
                                <Avatar
                                    key={c.id}
                                    name={c.name}
                                    src={c.avatarUrl}
                                    colorKey={String(c.id)}
                                    className="h-5 w-5 text-[9px] font-semibold"
                                />
                            ))}
                        </AvatarGroup>
                    </Tooltip>
                    <span className="truncate text-[13px] text-fg-secondary">
                        {formatContributorNames(names)}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CheckpointListItem;
