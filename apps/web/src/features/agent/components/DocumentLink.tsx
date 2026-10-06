import type { MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LuFileText } from "react-icons/lu";

/**
 * A link to a Converge document in an agent reply (e.g. a search citation,
 * "/document/12?blockId=…"): gold, with a file icon and a gold underline, as
 * in pp 67 / 72. A plain click opens it in the app and closes the panel so
 * the document shows; a modified click (new tab/window) is left to the browser.
 * @param href - the app-relative document URL
 * @param children - the link text, usually the document's title
 * @param onFollow - called after an in-app navigation, e.g. to close the panel
 */
const DocumentLink = ({
    href,
    children,
    onFollow,
}: {
    href: string;
    children: ReactNode;
    onFollow: () => void;
}) => {
    const navigate = useNavigate();

    /**
     * Opens the document in the app on a plain left click.
     * @param e - the click event
     */
    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
            return;
        e.preventDefault();
        navigate(href);
        onFollow();
    };

    return (
        <a
            href={href}
            onClick={handleClick}
            className="inline-flex items-baseline gap-1 border-b border-gold/60 text-gold transition-colors hover:border-gold"
        >
            <LuFileText className="h-3.5 w-3.5 shrink-0 self-center" />
            <span>{children}</span>
        </a>
    );
};

export default DocumentLink;
