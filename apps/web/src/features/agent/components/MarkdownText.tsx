import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DocumentLink from "./DocumentLink";

/**
 * Renders assistant text as Markdown (GFM: tables, strikethrough, task
 * lists) with the app's tokens instead of a typography plugin, at the
 * panel's reading size (pp 67 / 72): numbered lists, open-circle bullets
 * for nested lists, and app-relative links as gold document links. Other
 * links open in a new tab. Only used for assistant text — a user's own
 * message is plain text (see UserMessage).
 * @param text - the Markdown to render
 * @param onFollowLink - called when a document link opens in the app, e.g. to close the panel
 */
const MarkdownText = ({
    text,
    onFollowLink,
}: {
    text: string;
    onFollowLink: () => void;
}) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            p: ({ children }) => (
                <p className="whitespace-pre-wrap break-words">{children}</p>
            ),
            a: ({ children, href }) =>
                href?.startsWith("/") ? (
                    <DocumentLink href={href} onFollow={onFollowLink}>
                        {children}
                    </DocumentLink>
                ) : (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words text-gold underline hover:no-underline"
                    >
                        {children}
                    </a>
                ),
            ul: ({ children }) => (
                <ul className="flex list-disc flex-col gap-0.5 pl-5 [li_&]:mt-1 [li_&]:list-[circle]">
                    {children}
                </ul>
            ),
            ol: ({ children }) => (
                <ol className="flex list-decimal flex-col gap-2 pl-5 [li_&]:mt-1">
                    {children}
                </ol>
            ),
            li: ({ children }) => <li className="pl-1">{children}</li>,
            blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-line pl-3 italic text-fg-secondary">
                    {children}
                </blockquote>
            ),
            h1: ({ children }) => (
                <h1 className="mt-1 font-serif text-xl font-medium">
                    {children}
                </h1>
            ),
            h2: ({ children }) => (
                <h2 className="mt-1 font-serif text-lg font-medium">
                    {children}
                </h2>
            ),
            h3: ({ children }) => (
                <h3 className="mt-1 font-semibold">{children}</h3>
            ),
            hr: () => <hr className="border-line" />,
            code: ({ children }) => (
                <code className="break-words rounded bg-surface-hover px-1 py-0.5 font-mono text-[13px]">
                    {children}
                </code>
            ),
            pre: ({ children }) => (
                <pre className="overflow-x-auto rounded-md bg-surface-hover p-2 font-mono text-[13px] [&_code]:bg-transparent [&_code]:p-0">
                    {children}
                </pre>
            ),
            table: ({ children }) => (
                <div className="overflow-x-auto">
                    <table className="border-collapse text-sm">
                        {children}
                    </table>
                </div>
            ),
            th: ({ children }) => (
                <th className="border border-line px-2 py-1 text-left font-medium">
                    {children}
                </th>
            ),
            td: ({ children }) => (
                <td className="border border-line px-2 py-1">{children}</td>
            ),
        }}
    >
        {text}
    </ReactMarkdown>
);

export default MarkdownText;
