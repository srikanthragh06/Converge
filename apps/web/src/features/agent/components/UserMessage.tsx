/**
 * The user's message, right-aligned on the selected fill. Plain text, not
 * Markdown: it's what they typed, not model output meant to be formatted.
 * @param content - the message text
 */
const UserMessage = ({ content }: { content: string }) => (
    <div className="flex justify-end">
        <div className="min-w-0 max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-surface-selected px-4 py-3 text-[15px] leading-[1.6] text-fg">
            {content}
        </div>
    </div>
);

export default UserMessage;
