import { type Ref, useState } from "react";
import { LuMessageSquare } from "react-icons/lu";
import { AGENT_CONVERSATION_TITLE_MAX_LENGTH } from "@converge/shared";
import Input from "@/components/ui/Input";

/**
 * Rename field that takes the conversation picker's place while renaming.
 * Enter saves a non-empty title; Escape or clicking away discards the edit,
 * as the old conversation row's inline rename did.
 * @param inputRef - ref to the field, for the caller to focus it
 * @param initialTitle - the text the field starts with
 * @param onSave - called with the trimmed title on Enter (an empty title counts as a cancel)
 * @param onCancel - called on Escape or blur
 */
const RenameConversationInput = ({
    inputRef,
    initialTitle,
    onSave,
    onCancel,
}: {
    inputRef?: Ref<HTMLInputElement>;
    initialTitle: string;
    onSave: (title: string) => void;
    onCancel: () => void;
}) => {
    const [draft, setDraft] = useState(initialTitle); // the in-progress title

    return (
        <Input
            ref={inputRef}
            onFocus={(e) => e.target.select()}
            icon={<LuMessageSquare />}
            value={draft}
            maxLength={AGENT_CONVERSATION_TITLE_MAX_LENGTH}
            aria-label="Chat name"
            // The panel ignores an Escape from here, so it only ends the rename (see AgentPanelDialog).
            data-escape-local=""
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    const trimmed = draft.trim();
                    if (trimmed) onSave(trimmed);
                    else onCancel();
                } else if (e.key === "Escape") {
                    onCancel();
                }
            }}
            onBlur={onCancel}
            className="min-w-0 flex-1 sm:h-9"
        />
    );
};

export default RenameConversationInput;
