import { MdAdd } from "react-icons/md";
import Page from "../../components/Page";
import useAgentConversations from "../../hooks/useAgentConversations";
import ConversationRow from "./conversationRow/ConversationRow";

/**
 * Full-screen AI agent page. First cut, deliberately scoped to just
 * listing and selecting conversations — no chat history or message input
 * yet, that's a later pass once this scaffolding is in place.
 */
const AgentPage = () => {
    const {
        conversations,
        selectedConversationId,
        selectConversation,
        createConversation,
        isLoading,
        error,
    } = useAgentConversations();

    return (
        <Page authRequired haveSidebar className="items-center">
            <div className="w-full max-w-2xl h-full flex flex-col px-3 sm:px-6">
                {/* Header: page title and the "new conversation" action */}
                <div className="py-3 sm:py-4 shrink-0 flex items-center justify-between">
                    <h1 className="text-lg sm:text-xl font-medium text-text-primary">AI Agent</h1>
                    <button
                        onClick={() => void createConversation()}
                        className="flex items-center gap-1 text-sm sm:text-base text-text-primary hover:bg-background-hover rounded-md px-2 py-1 transition cursor-pointer"
                        aria-label="New conversation"
                    >
                        <MdAdd className="w-4 h-4 sm:w-5 sm:h-5" />
                        New Conversation
                    </button>
                </div>

                {/* Error banner: shown on a failed fetch or create */}
                {error && (
                    <div className="text-xs sm:text-sm text-highlights-red-text bg-highlights-red-background rounded-md px-3 py-2 mb-2">
                        {error}
                    </div>
                )}

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-1 pb-4">
                    {isLoading ? (
                        <p className="text-sm text-text-disabled px-2 py-1">Loading conversations…</p>
                    ) : conversations.length === 0 ? (
                        <p className="text-sm text-text-disabled px-2 py-1">
                            No conversations yet — start one above.
                        </p>
                    ) : (
                        conversations.map((conversation) => (
                            <ConversationRow
                                key={conversation.id}
                                conversation={conversation}
                                isSelected={conversation.id === selectedConversationId}
                                onSelect={() => selectConversation(conversation.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </Page>
    );
};

export default AgentPage;
