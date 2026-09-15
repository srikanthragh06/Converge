import { useState } from "react";
import { MdCheck, MdClose, MdEdit, MdDeleteOutline } from "react-icons/md";
import { AGENT_CONVERSATION_TITLE_MAX_LENGTH } from "@converge/shared";
import { formatDate } from "../../../utils/utils";
import type { AgentConversationSummary } from "../../../hooks/useAgentConversations";
import DeleteConversationConfirmationModal from "./DeleteConversationConfirmationModal";

/**
 * Renders one selectable conversation row, labeled by its title, or its
 * formatted creation date when untitled. Rename/delete actions sit in their
 * own always-visible flex slot (not overlaid on the label) so the title
 * truncates before it, rather than running under the icons. Renaming swaps
 * the label for an inline text input in place, and deleting opens a
 * confirmation modal since it's irreversible (no trash for conversations).
 */
const ConversationRow = ({
    conversation,
    isSelected,
    onSelect,
    onRename,
    onDelete,
}: {
    conversation: AgentConversationSummary;
    isSelected: boolean;
    onSelect: () => void;
    /** Renames this conversation. Resolves once the rename request settles. */
    onRename: (title: string) => Promise<void>;
    /** Deletes this conversation. Resolves once the delete request settles. */
    onDelete: () => Promise<void>;
}) => {
    const [isEditing, setIsEditing] = useState(false); // true while the label is replaced by a rename input
    const [draftTitle, setDraftTitle] = useState(""); // in-progress edit, seeded from the current title when editing starts
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false); // true while the delete confirmation modal is open

    /** Enters edit mode, seeding the draft with the current title (or blank, for an untitled conversation). */
    const startEditing = () => {
        setDraftTitle(conversation.title ?? "");
        setIsEditing(true);
    };

    /** Discards the draft and exits edit mode. Also what runs on click-away (blur) — leaving the input without explicitly confirming discards the edit rather than saving it. */
    const cancelEdit = () => setIsEditing(false);

    /** Saves the draft if it's non-empty, then exits edit mode either way — an empty/whitespace-only draft is discarded rather than saved as a blank title. Only reachable via Enter or the checkmark button, both of which keep the input focused (see the checkmark's onMouseDown) so this runs instead of the blur-triggered cancelEdit. */
    const saveEdit = async () => {
        const trimmed = draftTitle.trim();
        setIsEditing(false);
        if (trimmed.length > 0 && trimmed !== conversation.title) {
            await onRename(trimmed);
        }
    };

    return (
        <div
            className={`flex items-center rounded-md transition ${
                isSelected ? "bg-accent-blue" : "hover:bg-background-hover"
            }`}
        >
            {isEditing ? (
                /* Rename input, replacing the label + actions while editing */
                <div className="flex-1 flex items-center gap-1 pl-2 pr-1 py-1">
                    <input
                        autoFocus
                        value={draftTitle}
                        maxLength={AGENT_CONVERSATION_TITLE_MAX_LENGTH}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit();
                            if (e.key === "Escape") cancelEdit();
                        }}
                        onBlur={cancelEdit}
                        className="flex-1 min-w-0 text-sm sm:text-base bg-background-hover
                            text-text-primary rounded-md px-2 py-1 outline-none border-none"
                    />
                    <button
                        // Keeps the input focused on mousedown so this click never fires the
                        // input's onBlur first — that would already have run saveEdit and
                        // unmounted this button before the click event reaches it.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void saveEdit()}
                        aria-label="Save title"
                        className="shrink-0 p-1 rounded-full bg-background-hover text-highlights-green-text
                            hover:opacity-80 cursor-pointer"
                    >
                        <MdCheck className="w-4 h-4" />
                    </button>
                    <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={cancelEdit}
                        aria-label="Cancel rename"
                        className="shrink-0 p-1 rounded-full bg-background-hover text-text-secondary
                            hover:text-text-primary cursor-pointer"
                    >
                        <MdClose className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <>
                    {/* Selectable label — title, or the formatted creation date when untitled */}
                    <button
                        onClick={onSelect}
                        className={`flex-1 min-w-0 text-left px-3 py-2 text-sm sm:text-base truncate cursor-pointer ${
                            isSelected ? "text-text-white" : "text-text-primary"
                        }`}
                    >
                        {conversation.title ?? formatDate(conversation.createdAt)}
                    </button>
                    {/* Always-visible rename/delete actions, in their own flex slot so the label truncates before them instead of running underneath */}
                    <div className="flex items-center gap-0.5 shrink-0 pl-1 pr-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                startEditing();
                            }}
                            aria-label="Rename conversation"
                            className={`p-1 rounded cursor-pointer ${
                                isSelected
                                    ? "text-text-white hover:opacity-80"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            <MdEdit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsConfirmingDelete(true);
                            }}
                            aria-label="Delete conversation"
                            className={`p-1 rounded cursor-pointer ${
                                isSelected
                                    ? "text-text-white hover:opacity-80"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            <MdDeleteOutline className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}

            {/* Delete confirmation modal — irreversible, so it's gated behind an explicit confirm rather than deleting on the first click */}
            {isConfirmingDelete && (
                <DeleteConversationConfirmationModal
                    onConfirm={async () => {
                        await onDelete();
                        setIsConfirmingDelete(false);
                    }}
                    onCancel={() => setIsConfirmingDelete(false)}
                />
            )}
        </div>
    );
};

export default ConversationRow;
