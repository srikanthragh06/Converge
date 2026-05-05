import { RxAvatar } from "react-icons/rx";
import { type DocumentAccessLevel } from "@converge/shared";

/**
 * Card displaying a single user's document access entry. Shows a circular
 * avatar on the left, name and email stacked in the centre, and the access
 * level label on the far right.
 */
const DocumentAccessUserCard = ({
    avatarUrl,
    name,
    email,
    userId,
    documentId,
    access,
}: {
    /** URL of the user's profile picture, or null to show the generic icon. */
    avatarUrl: string | null;
    /** Display name of the user. */
    name: string;
    /** Email address of the user. */
    email: string;
    /** ID of the user. */
    userId: number;
    /** ID of the document. */
    documentId: string | undefined;
    /** Access level granted to this user. */
    access: DocumentAccessLevel;
}) => {
    return (
        <div className="flex items-center gap-3 py-2">
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt={name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                />
            ) : (
                <RxAvatar className="w-8 h-8 text-text-secondary shrink-0" />
            )}
            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm text-text-primary truncate">
                    {name}
                </span>
                <span className="text-xs text-text-secondary truncate">
                    {email}
                </span>
            </div>
            <span className="text-sm text-text-secondary shrink-0 capitalize">
                {access}
            </span>
        </div>
    );
};

export default DocumentAccessUserCard;
