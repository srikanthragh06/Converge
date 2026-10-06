import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
    LuCheck,
    LuChevronDown,
    LuMessageSquare,
    LuSearch,
} from "react-icons/lu";
import type { AgentConversationSummary } from "@/features/agent/hooks/useAgentConversations";
import { cn } from "@/lib/utils";
import Input from "@/components/ui/Input";
import Tooltip from "@/components/ui/Tooltip";
import { conversationLabel } from "./conversationLabel";

/**
 * Conversation dropdown in the Ask Converge header (p70): the trigger shows
 * the open conversation's name; the popup has a "Find a conversation" field
 * that filters by name, and one row per conversation, newest-used first, the
 * open one bold with a gold check. ↑↓ move the highlight and ↵ opens it.
 * Replaces the old page's conversation list.
 * @param conversations - the workspace's conversations, newest-used first
 * @param selectedId - the open conversation's id, or null
 * @param label - trigger text, e.g. the open conversation's name or "New conversation"
 * @param onSelect - opens the chosen conversation
 */
const ConversationPicker = ({
    conversations,
    selectedId,
    label,
    onSelect,
}: {
    conversations: AgentConversationSummary[];
    selectedId: number | null;
    label: string;
    onSelect: (conversationId: number) => void;
}) => {
    const [open, setOpen] = useState(false); // whether the popup is showing
    const [query, setQuery] = useState(""); // text in the find field
    const [activeIndex, setActiveIndex] = useState(0); // highlighted row among the filtered ones

    const needle = query.trim().toLowerCase();
    const filtered = conversations.filter((c) =>
        conversationLabel(c).toLowerCase().includes(needle),
    );

    /**
     * Opens or closes the popup, starting each open with an empty field and
     * the first row highlighted.
     * @param next - whether the popup should be open
     */
    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) {
            setQuery("");
            setActiveIndex(0);
        }
    };

    /**
     * Opens a conversation and closes the popup.
     * @param conversationId - the conversation to open
     */
    const choose = (conversationId: number) => {
        onSelect(conversationId);
        setOpen(false);
    };

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg border border-line-strong bg-surface-elevated px-3 text-sm text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-gold/60 data-[state=open]:border-gold"
                >
                    <LuMessageSquare className="h-4 w-4 shrink-0 text-fg-muted" />
                    <Tooltip content={label}>
                        <span className="min-w-0 flex-1 truncate text-left">
                            {label}
                        </span>
                    </Tooltip>
                    <LuChevronDown className="h-4 w-4 shrink-0 text-fg-muted" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={6}
                    collisionPadding={8}
                    // Spans the header row, as in the mockup: picker, ⋯, and New chat.
                    className="z-[70] flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[calc(100vw-2rem)] animate-fade-in flex-col overflow-hidden rounded-lg border border-line-strong bg-surface-elevated p-2 text-fg shadow-lg shadow-shadow outline-none sm:w-[488px]"
                >
                    <Input
                        autoFocus
                        icon={<LuSearch />}
                        placeholder="Find a conversation"
                        aria-label="Find a conversation"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setActiveIndex((i) =>
                                    Math.min(i + 1, filtered.length - 1),
                                );
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setActiveIndex((i) => Math.max(i - 1, 0));
                            } else if (e.key === "Enter") {
                                const conversation = filtered[activeIndex];
                                if (conversation) choose(conversation.id);
                            }
                        }}
                        className="shrink-0 sm:h-9"
                    />
                    <div
                        role="listbox"
                        aria-label="Conversations"
                        className="mt-1.5 flex min-h-0 flex-col overflow-y-auto"
                    >
                        {filtered.length === 0 ? (
                            <p className="px-3 py-2.5 text-sm text-fg-muted">
                                {conversations.length === 0
                                    ? "No conversations yet"
                                    : "No conversations match"}
                            </p>
                        ) : (
                            filtered.map((conversation, index) => {
                                const isSelected =
                                    conversation.id === selectedId;
                                return (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        tabIndex={-1}
                                        onClick={() => choose(conversation.id)}
                                        onMouseMove={() =>
                                            setActiveIndex(index)
                                        }
                                        ref={(el) => {
                                            if (index === activeIndex)
                                                el?.scrollIntoView({
                                                    block: "nearest",
                                                });
                                        }}
                                        className={cn(
                                            "flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-fg outline-none",
                                            index === activeIndex &&
                                                "bg-surface-hover",
                                            isSelected && "font-semibold",
                                        )}
                                    >
                                        <Tooltip
                                            content={conversationLabel(
                                                conversation,
                                            )}
                                            side="right"
                                        >
                                            <span className="min-w-0 flex-1 truncate">
                                                {conversationLabel(
                                                    conversation,
                                                )}
                                            </span>
                                        </Tooltip>
                                        {isSelected && (
                                            <LuCheck className="h-4 w-4 shrink-0 text-gold" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
};

export default ConversationPicker;
