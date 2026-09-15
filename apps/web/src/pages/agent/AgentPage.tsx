import { MdAdd } from "react-icons/md";
import Page from "../../components/Page";
import useAgentConversations from "../../hooks/useAgentConversations";
import useAgentConversation from "../../hooks/useAgentConversation";
import ConversationRow from "./conversationRow/ConversationRow";
import MessageList from "./messageList/MessageList";

/**
 * Full-screen AI agent page. Two panes: a conversation list (left) and the
 * selected conversation's message history (right), read-only so far — no
 * message composer/live sending yet, that's a later pass once this
 * scaffolding is in place (see the AI agent chat plan discussion).
 */
const AgentPage = () => {
    const {
        conversations,
        selectedConversationId,
        selectConversation,
        createConversation,
        isLoading: isLoadingConversations,
        error: conversationsError,
    } = useAgentConversations();
    const {
        messages,
        isLoading: isLoadingMessages,
        error: messagesError,
    } = useAgentConversation(selectedConversationId);

    return (
        <Page authRequired haveSidebar>
            <div className="w-full h-full flex flex-col sm:flex-row overflow-hidden">
                {/* Left pane: conversation list */}
                <div className="w-full sm:w-64 shrink-0 h-1/3 sm:h-full flex flex-col px-3 sm:px-4 border-b sm:border-b-0 sm:border-r border-border">
                    <div className="py-3 sm:py-4 shrink-0 flex items-center justify-between">
                        <h1 className="text-lg sm:text-xl font-medium text-text-primary">
                            Converge Agent
                        </h1>
                        <button
                            onClick={() => void createConversation()}
                            className="flex items-center gap-1 text-sm text-text-primary hover:bg-background-hover rounded-md px-2 py-1 transition cursor-pointer"
                            aria-label="New conversation"
                        >
                            <MdAdd className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    {conversationsError && (
                        <div className="text-xs sm:text-sm text-highlights-red-text bg-highlights-red-background rounded-md px-3 py-2 mb-2">
                            {conversationsError}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto flex flex-col gap-1 pb-4">
                        {isLoadingConversations ? (
                            <p className="text-sm text-text-disabled px-2 py-1">
                                Loading conversations…
                            </p>
                        ) : conversations.length === 0 ? (
                            <p className="text-sm text-text-disabled px-2 py-1">
                                No conversations yet — start one above.
                            </p>
                        ) : (
                            conversations.map((conversation) => (
                                <ConversationRow
                                    key={conversation.id}
                                    conversation={conversation}
                                    isSelected={
                                        conversation.id ===
                                        selectedConversationId
                                    }
                                    onSelect={() =>
                                        selectConversation(conversation.id)
                                    }
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Right pane: selected conversation's message history */}
                <div className="flex-1 min-w-0 h-2/3 sm:h-full overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
                    {selectedConversationId === null ? (
                        <p className="text-sm text-text-disabled px-2 py-1">
                            Select or start a conversation to view it.
                        </p>
                    ) : messagesError ? (
                        <div className="text-xs sm:text-sm text-highlights-red-text bg-highlights-red-background rounded-md px-3 py-2">
                            {messagesError}
                        </div>
                    ) : isLoadingMessages ? (
                        <p className="text-sm text-text-disabled px-2 py-1">
                            Loading messages…
                        </p>
                    ) : messages.length === 0 ? (
                        <p className="text-sm text-text-disabled px-2 py-1">
                            No messages yet in this conversation.
                        </p>
                    ) : (
                        <MessageList messages={messages} />
                    )}
                </div>
            </div>
        </Page>
    );
};

export default AgentPage;
