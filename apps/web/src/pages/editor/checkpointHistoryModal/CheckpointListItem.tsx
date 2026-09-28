import type { DocumentCheckpointDto } from "@converge/shared";
import { formatDate } from "../../../utils/utils";
import { Avatar, AvatarGroup } from "../../../components/ui/Avatar";
import Tooltip from "../../../components/ui/Tooltip";

/** Maximum number of contributor avatars shown before the rest are collapsed (still counted in the tooltip). */
const MAX_VISIBLE_CONTRIBUTOR_AVATARS = 4;
/** Maximum number of contributor names spelled out inline before collapsing to "and many others". */
const MAX_NAMED_CONTRIBUTORS = 3;

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
 * One row in the checkpoint history list. First line shows lastEditedAt —
 * the timestamp of the actual last edit folded into this checkpoint, not
 * createdAt (when the checkpoint row itself was inserted, which can lag
 * behind for automatic checkpoints) — and a Manual/Auto/"Before AI edit"
 * label derived from the checkpoint's source. Second line shows a
 * stacked-avatar contributor summary — up to
 * MAX_VISIBLE_CONTRIBUTOR_AVATARS avatars, and inline names
 * capped separately at MAX_NAMED_CONTRIBUTORS. Hovering the avatar stack
 * shows every contributor's name, including ones collapsed out of both caps.
 * Clicking the row selects it; isSelected controls the highlighted style.
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
            onClick={onSelect}
            className={`px-3 py-2.5 border-b border-line
        cursor-pointer transition ${
            isSelected
                ? "bg-surface-selected"
                : "hover:opacity-80 active:opacity-60"
        }`}
        >
            {/* Row 1: last-edited time (left) and Manual/Auto/"Before AI edit" source label (right) */}
            <div className="flex items-center justify-between text-xs">
                <span className="text-fg-secondary">
                    {formatDate(checkpoint.lastEditedAt)}
                </span>
                <span className="text-fg-secondary opacity-60">
                    {checkpoint.source === "manual"
                        ? "Manual"
                        : checkpoint.source === "mcp"
                          ? "Before AI edit"
                          : "Auto"}
                </span>
            </div>
            {/* Row 2: stacked contributor avatars + names, only rendered if there are any contributors */}
            {checkpoint.contributors.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                    <Tooltip
                        side="top"
                        content={checkpoint.contributors.map((c) => (
                            <p key={c.id}>{c.name}</p>
                        ))}
                    >
                        <AvatarGroup className="shrink-0">
                            {visibleContributors.map((c) => (
                                <Avatar
                                    key={c.id}
                                    name={c.name}
                                    src={c.avatarUrl}
                                />
                            ))}
                        </AvatarGroup>
                    </Tooltip>
                    <span className="text-xs text-fg-secondary truncate">
                        {formatContributorNames(names)}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CheckpointListItem;
