import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import useAgentConversations from "../../hooks/useAgentConversations";
import useAgentChat from "../../hooks/useAgentChat";
import AgentPanelHeader from "./AgentPanelHeader";
import AgentEmptyState from "./AgentEmptyState";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import DeleteConversationModal from "./DeleteConversationModal";

/**
 * The Ask Converge side panel (pp 67–76): a right-hand slide-over, 520px
 * wide (full screen on phones, pp 81 / 87), over a blurred, lightly dimmed
 * page. Owns the conversation list and the selected conversation's chat;
 * this component stays mounted while the panel is closed (see AgentPanel),
 * so both survive closing and reopening it. Built on Radix Dialog for
 * focus trapping, Escape, and the outside click that closes it.
 * @param open - whether the panel is shown
 * @param onClose - called on Escape, an outside click, the close button, or following a document link
 */
const AgentPanelDialog = ({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) => {
    const {
        conversations,
        selectedConversationId,
        selectConversation,
        createConversation,
        renameConversation,
        deleteConversation,
        isLoading: isLoadingConversations,
        error: conversationsError,
    } = useAgentConversations();
    const {
        messages,
        pendingUserContent,
        streamingSteps,
        isLoadingHistory,
        isStreaming,
        error: chatError,
        send,
    } = useAgentChat(selectedConversationId);
    const [isStarting, setIsStarting] = useState(false); // true while a first message waits for its new conversation to be created
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false); // true while the delete confirmation is open

    const selectedConversation = conversations.find(
        (c) => c.id === selectedConversationId,
    );
    const hasContent =
        messages.length > 0 ||
        pendingUserContent !== null ||
        streamingSteps.length > 0;
    const error = conversationsError ?? chatError;

    /**
     * Sends a message into the selected conversation, first creating one if
     * nothing is selected yet (e.g. a workspace with no conversations), so
     * the composer always works.
     * @param content - the trimmed message text
     */
    const handleSend = async (content: string) => {
        if (selectedConversationId !== null) {
            await send(content);
            return;
        }
        setIsStarting(true);
        const newId = await createConversation();
        setIsStarting(false);
        if (newId !== null) await send(content, newId);
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay-panel backdrop-blur-[8px]" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    // Opens with the message field focused, ready to type, rather than the close
                    // button — except on touch screens, where that would pop up the keyboard.
                    onOpenAutoFocus={(e) => {
                        if (window.matchMedia("(pointer: coarse)").matches)
                            return;
                        e.preventDefault();
                        (e.currentTarget as HTMLElement)
                            .querySelector("textarea")
                            ?.focus();
                    }}
                    // A field marked data-escape-local (the rename field) handles Escape itself.
                    onEscapeKeyDown={(e) => {
                        if (
                            e.target instanceof Element &&
                            e.target.closest("[data-escape-local]")
                        )
                            e.preventDefault();
                    }}
                    className="fixed inset-y-0 right-0 z-[60] flex w-full animate-panel-in flex-col bg-surface-elevated text-fg shadow-2xl shadow-shadow outline-none sm:w-[520px] sm:border-l sm:border-line"
                >
                    <AgentPanelHeader
                        conversations={conversations}
                        selectedConversation={selectedConversation}
                        isNewConversation={
                            !selectedConversation ||
                            (selectedConversation.title === null &&
                                !hasContent &&
                                !isLoadingHistory)
                        }
                        onSelect={selectConversation}
                        onNewChat={() => void createConversation()}
                        onRename={(title) =>
                            selectedConversation
                                ? renameConversation(
                                      selectedConversation.id,
                                      title,
                                  )
                                : Promise.resolve()
                        }
                        onDelete={() => setIsConfirmingDelete(true)}
                    />

                    {/* Conversation, or the empty state for a new one — kept on screen when an error shows below it */}
                    {isLoadingConversations || isLoadingHistory ? (
                        <p className="flex-1 px-[22px] py-6 text-sm text-fg-muted">
                            Loading…
                        </p>
                    ) : hasContent ? (
                        <MessageList
                            key={selectedConversationId}
                            messages={messages}
                            pendingUserContent={pendingUserContent}
                            streamingSteps={streamingSteps}
                            isStreaming={isStreaming}
                            onFollowLink={onClose}
                        />
                    ) : error ? (
                        // Blank rather than the empty state, which would read as "this chat is empty" after a failed load
                        <div className="flex-1" />
                    ) : (
                        <AgentEmptyState />
                    )}

                    {/* Error strip (e.g. a rate limit), under the conversation rather than replacing it */}
                    {error && (
                        <p className="mx-4 mb-2 shrink-0 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                            {error}
                        </p>
                    )}

                    <MessageComposer
                        onSend={(content) => void handleSend(content)}
                        disabled={isStreaming || isStarting}
                    />

                    {/* Inside Content, so Radix treats it as a nested layer rather than an outside click */}
                    {isConfirmingDelete && selectedConversation && (
                        <DeleteConversationModal
                            onConfirm={async () => {
                                await deleteConversation(
                                    selectedConversation.id,
                                );
                                setIsConfirmingDelete(false);
                            }}
                            onCancel={() => setIsConfirmingDelete(false)}
                        />
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default AgentPanelDialog;
