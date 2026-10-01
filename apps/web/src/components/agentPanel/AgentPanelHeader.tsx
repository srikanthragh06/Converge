import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
    LuEllipsis,
    LuPencil,
    LuPlus,
    LuSparkle,
    LuTrash2,
    LuX,
} from "react-icons/lu";
import type { AgentConversationSummary } from "../../hooks/useAgentConversations";
import { formatShortcut } from "../../lib/utils";
import Button from "../ui/Button";
import { DropdownMenu } from "../ui/Menu";
import ConversationPicker from "./ConversationPicker";
import RenameConversationInput from "./RenameConversationInput";
import { conversationLabel } from "./conversationLabel";

/**
 * Top of the Ask Converge panel (pp 67–71): a sparkle, the serif title, a
 * ⌘J hint and a close button, then the conversation row — the picker, a ⋯
 * menu (Rename chat / Delete chat), and a gold New chat button (a plus alone
 * on phones). Rename swaps the picker for a text field in place.
 * @param conversations - the workspace's conversations, newest-used first
 * @param selectedConversation - the open conversation, if any
 * @param isNewConversation - shows "New conversation" in the picker, for a
 *                            fresh, empty, untitled conversation (or none yet)
 * @param onSelect - opens another conversation
 * @param onNewChat - starts a new conversation
 * @param onRename - renames the open conversation
 * @param onDelete - asks to delete the open conversation
 */
const AgentPanelHeader = ({
    conversations,
    selectedConversation,
    isNewConversation,
    onSelect,
    onNewChat,
    onRename,
    onDelete,
}: {
    conversations: AgentConversationSummary[];
    selectedConversation: AgentConversationSummary | undefined;
    isNewConversation: boolean;
    onSelect: (conversationId: number) => void;
    onNewChat: () => void;
    onRename: (title: string) => void;
    onDelete: () => void;
}) => {
    const [isRenaming, setIsRenaming] = useState(false); // true while the picker is swapped for the rename field
    const renameChosenRef = useRef(false); // set by Rename chat, so the closing menu hands focus to the rename field
    const renameInputRef = useRef<HTMLInputElement>(null); // the rename field, focused once the menu has closed

    return (
        <div className="shrink-0 border-b border-line">
            {/* Title row */}
            <div className="flex h-[58px] items-center gap-2.5 px-4 sm:px-6">
                <LuSparkle className="h-4 w-4 shrink-0 text-gold" />
                <DialogPrimitive.Title className="font-serif text-[22px] font-medium leading-none text-fg">
                    Ask Converge
                </DialogPrimitive.Title>
                <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] leading-none text-fg-muted sm:inline">
                    {formatShortcut("J")}
                </kbd>
                <DialogPrimitive.Close
                    aria-label="Close"
                    className="-mr-1.5 ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-gold/60 sm:h-7 sm:w-7"
                >
                    <LuX className="h-5 w-5 sm:h-4 sm:w-4" />
                </DialogPrimitive.Close>
            </div>

            {/* Conversation row */}
            <div className="flex items-center gap-2 px-4 pb-4">
                {isRenaming && selectedConversation ? (
                    <RenameConversationInput
                        inputRef={renameInputRef}
                        initialTitle={
                            selectedConversation.title ??
                            conversationLabel(selectedConversation)
                        }
                        onSave={(title) => {
                            setIsRenaming(false);
                            if (title !== selectedConversation.title)
                                onRename(title);
                        }}
                        onCancel={() => setIsRenaming(false)}
                    />
                ) : (
                    <ConversationPicker
                        conversations={conversations}
                        selectedId={selectedConversation?.id ?? null}
                        label={
                            isNewConversation || !selectedConversation
                                ? "New conversation"
                                : conversationLabel(selectedConversation)
                        }
                        onSelect={onSelect}
                    />
                )}
                <DropdownMenu
                    onCloseAutoFocus={(e) => {
                        // The menu traps focus until it closes, so the rename field is focused
                        // here instead of by autoFocus, in place of returning focus to ⋯.
                        if (renameChosenRef.current) {
                            e.preventDefault();
                            renameInputRef.current?.focus();
                        }
                        renameChosenRef.current = false;
                    }}
                    trigger={
                        <Button
                            size="icon"
                            aria-label="Chat options"
                            disabled={!selectedConversation}
                            className="h-9 w-9 data-[state=open]:border-gold"
                        >
                            <LuEllipsis />
                        </Button>
                    }
                    items={[
                        {
                            label: "Rename chat",
                            icon: <LuPencil />,
                            onSelect: () => {
                                renameChosenRef.current = true;
                                setIsRenaming(true);
                            },
                        },
                        {
                            label: "Delete chat",
                            icon: <LuTrash2 />,
                            destructive: true,
                            onSelect: onDelete,
                        },
                    ]}
                />
                <Button
                    variant="primary"
                    onClick={onNewChat}
                    aria-label="New chat"
                    className="h-9 w-9 px-0 sm:w-auto sm:px-3.5"
                >
                    <LuPlus />
                    <span className="hidden sm:inline">New chat</span>
                </Button>
            </div>
        </div>
    );
};

export default AgentPanelHeader;
