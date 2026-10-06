import { LuCircleAlert, LuClock } from "react-icons/lu";
import Button from "@/components/ui/Button";

/**
 * Shown in place of semantic results when a semantic search can't run:
 * the user's rate limit was hit, or the search failed for another reason.
 * Either way lexical search still works, so the button switches to it.
 * @param reason - "rateLimited" (a 429) or "failed" (any other error)
 * @param onSearchLexically - switches the palette to lexical mode
 */
const SemanticNoticeScreen = ({
    reason,
    onSearchLexically,
}: {
    reason: "rateLimited" | "failed";
    onSearchLexically: () => void;
}) => {
    let icon = <LuClock className="h-5 w-5 text-fg-secondary" />;
    let heading = "Semantic search is rate-limited right now";
    let body = "Try again in a little while — lexical search still works.";
    if (reason === "failed") {
        icon = <LuCircleAlert className="h-5 w-5 text-fg-secondary" />;
        heading = "Couldn't run semantic search";
        body = "Try again, or search lexically.";
    }

    return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
            {icon}
            <p className="mt-4 text-base font-semibold text-fg">{heading}</p>
            <p className="mt-2 text-sm text-fg-muted">{body}</p>
            <Button
                variant="primary"
                className="mt-5"
                onClick={onSearchLexically}
            >
                Search lexically instead
            </Button>
        </div>
    );
};

export default SemanticNoticeScreen;
