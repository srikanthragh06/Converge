import MarkdownText from "./MarkdownText";
import StreamingCursor from "./StreamingCursor";
import ToolCallRow from "./ToolCallRow";

/**
 * One assistant step (pp 67 / 68): its tool calls as Called / Calling rows,
 * then its text, unboxed at the panel's reading size. `status` on a tool
 * call is omitted for persisted history (every call there has finished)
 * and "pending" / "done" for a live step.
 * @param text - the step's Markdown text, possibly empty
 * @param toolCalls - the tools the step called
 * @param streaming - true for the step still receiving text: shows the gold cursor after it
 * @param onFollowLink - called when a document link opens in the app
 */
const AssistantStep = ({
    text,
    toolCalls,
    streaming,
    onFollowLink,
}: {
    text: string;
    toolCalls: {
        toolCallId: string;
        toolName: string;
        status?: "pending" | "done";
    }[];
    streaming?: boolean;
    onFollowLink: () => void;
}) => (
    <div className="flex flex-col gap-3">
        {toolCalls.length > 0 && (
            <div className="flex flex-col">
                {toolCalls.map((call) => (
                    <ToolCallRow
                        key={call.toolCallId}
                        toolName={call.toolName}
                        pending={call.status === "pending"}
                    />
                ))}
            </div>
        )}
        {text ? (
            <div
                className={`flex min-w-0 flex-col gap-3 text-[15px] leading-[1.65] text-fg ${
                    streaming ? "agent-streaming" : ""
                }`}
            >
                <MarkdownText text={text} onFollowLink={onFollowLink} />
            </div>
        ) : (
            streaming &&
            toolCalls.every((call) => call.status !== "pending") && (
                <StreamingCursor />
            )
        )}
    </div>
);

export default AssistantStep;
