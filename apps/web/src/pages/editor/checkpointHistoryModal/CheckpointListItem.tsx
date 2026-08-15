import { Avatar } from "primereact/avatar";
import { AvatarGroup } from "primereact/avatargroup";
import { Tooltip } from "primereact/tooltip";
import type { DocumentCheckpointDto } from "@converge/shared";
import { formatDate } from "../../../utils/utils";
import { colors } from "../../../theme/colors";

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
 * One row in the checkpoint history list. First line shows the creation
 * time and a Manual/Auto label derived from the checkpoint's source. Second
 * line shows a stacked-avatar contributor summary — up to
 * MAX_VISIBLE_CONTRIBUTOR_AVATARS avatars, and inline names capped
 * separately at MAX_NAMED_CONTRIBUTORS. Hovering the avatar stack shows
 * every contributor's name, including ones collapsed out of both caps.
 */
const CheckpointListItem = ({
    checkpoint,
}: {
    checkpoint: DocumentCheckpointDto;
}) => {
    const visibleContributors = checkpoint.contributors.slice(
        0,
        MAX_VISIBLE_CONTRIBUTOR_AVATARS,
    ); // avatars rendered explicitly
    const names = checkpoint.contributors.map((c) => c.name); // full contributor name list, used for both the inline summary and the tooltip

    return (
        <div className="px-3 py-2.5 border-b border-background-elevated">
            {/* Row 1: creation time (left) and Manual/Auto source label (right) */}
            <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                    {formatDate(checkpoint.createdAt)}
                </span>
                <span className="text-text-secondary opacity-60">
                    {checkpoint.source === "manual" ? "Manual" : "Auto"}
                </span>
            </div>
            {/* Row 2: stacked contributor avatars + names, only rendered if there are any contributors */}
            {checkpoint.contributors.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                    <Tooltip
                        target={`#checkpoint-${checkpoint.id}-contributors`}
                        position="top"
                        pt={{
                            text: {
                                style: {
                                    backgroundColor:
                                        colors.tooltip.background,
                                    color: colors.text.secondary,
                                    fontSize: "0.75rem",
                                    padding: "0.375rem 0.5rem",
                                },
                            },
                            arrow: {
                                style: {
                                    borderTopColor: colors.tooltip.background,
                                },
                            },
                        }}
                    >
                        {checkpoint.contributors.map((c) => (
                            <p key={c.id}>{c.name}</p>
                        ))}
                    </Tooltip>
                    <AvatarGroup
                        id={`checkpoint-${checkpoint.id}-contributors`}
                        className="shrink-0"
                    >
                        {visibleContributors.map((c) => (
                            <Avatar
                                key={c.id}
                                shape="circle"
                                className="w-6 h-6"
                                template={
                                    c.avatarUrl ? (
                                        <img
                                            src={c.avatarUrl}
                                            referrerPolicy="no-referrer"
                                            alt={c.name}
                                            className="w-full h-full object-cover rounded-full"
                                        />
                                    ) : (
                                        <span className="text-xs">
                                            {c.name[0]?.toUpperCase() ?? "?"}
                                        </span>
                                    )
                                }
                            />
                        ))}
                    </AvatarGroup>
                    <span className="text-xs text-text-secondary truncate">
                        {formatContributorNames(names)}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CheckpointListItem;
