import { formatDate } from "../../../utils/utils";
import type { AgentConversationSummary } from "../../../hooks/useAgentConversations";

/** Renders one selectable conversation row, labeled by its creation date since conversations have no title field yet. */
const ConversationRow = ({
    conversation,
    isSelected,
    onSelect,
}: {
    conversation: AgentConversationSummary;
    isSelected: boolean;
    onSelect: () => void;
}) => (
    <button
        onClick={onSelect}
        className={`text-left px-3 py-2 rounded-md text-sm sm:text-base transition cursor-pointer ${
            isSelected
                ? "bg-accent-blue text-text-white"
                : "text-text-primary hover:bg-background-hover"
        }`}
    >
        {formatDate(conversation.createdAt)}
    </button>
);

export default ConversationRow;
