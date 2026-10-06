/** Gold block shown while a reply streams: alone while the agent is thinking, and after the text as it arrives (see `.agent-streaming` in index.css). */
const StreamingCursor = () => (
    <span
        aria-hidden
        className="inline-block h-[1.1em] w-2 shrink-0 bg-gold align-text-bottom"
    />
);

export default StreamingCursor;
