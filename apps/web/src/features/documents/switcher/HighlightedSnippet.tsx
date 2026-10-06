import type { ReactNode } from "react";
import { SEARCH_HIGHLIGHT_END, SEARCH_HIGHLIGHT_START } from "@converge/shared";

/**
 * A passage snippet with its matched words highlighted. The server wraps
 * each matched word in the two highlight markers; this splits on them and
 * renders the words between as `<mark>`, so no HTML from the server is ever
 * rendered. A start marker with no end highlights to the end of the snippet.
 * @param snippet - the passage's plain-text snippet, with markers in lexical mode
 */
const HighlightedSnippet = ({ snippet }: { snippet: string }) => {
    const parts: ReactNode[] = [];
    let rest = snippet;
    while (rest.length > 0) {
        const start = rest.indexOf(SEARCH_HIGHLIGHT_START);
        if (start === -1) {
            parts.push(rest);
            break;
        }
        if (start > 0) parts.push(rest.slice(0, start));
        let end = rest.indexOf(SEARCH_HIGHLIGHT_END, start + 1);
        if (end === -1) end = rest.length;
        parts.push(
            <mark
                key={parts.length}
                className="rounded-sm bg-gold/20 px-0.5 text-fg"
            >
                {rest.slice(start + 1, end)}
            </mark>,
        );
        rest = rest.slice(end + 1);
    }
    return <>{parts}</>;
};

export default HighlightedSnippet;
