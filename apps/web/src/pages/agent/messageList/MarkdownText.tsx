import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant chat text as Markdown (GFM: tables, strikethrough, task
 * lists) using this app's own Tailwind colour tokens instead of a
 * typography plugin. Only used for assistant text — a user's own message is
 * rendered as plain text elsewhere, since it's their literal typed input,
 * not model output meant to be formatted.
 */
const MarkdownText = ({ text }: { text: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            p: ({ children }) => (
                <p className="whitespace-pre-wrap break-words leading-relaxed">{children}</p>
            ),
            a: ({ children, href }) => (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-blue underline hover:no-underline break-words"
                >
                    {children}
                </a>
            ),
            ul: ({ children }) => (
                <ul className="list-disc pl-5 flex flex-col gap-1">{children}</ul>
            ),
            ol: ({ children }) => (
                <ol className="list-decimal pl-5 flex flex-col gap-1">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-snug">{children}</li>,
            blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-border pl-3 text-text-secondary italic">
                    {children}
                </blockquote>
            ),
            h1: ({ children }) => (
                <h1 className="text-base font-semibold mt-1">{children}</h1>
            ),
            h2: ({ children }) => (
                <h2 className="text-sm font-semibold mt-1">{children}</h2>
            ),
            h3: ({ children }) => (
                <h3 className="text-sm font-medium mt-1">{children}</h3>
            ),
            hr: () => <hr className="border-border" />,
            code: ({ children }) => (
                <code className="bg-background-overlay rounded px-1 py-0.5 text-xs font-mono break-words">
                    {children}
                </code>
            ),
            pre: ({ children }) => (
                <pre className="bg-background-overlay rounded-md p-2 overflow-x-auto text-xs font-mono">
                    {children}
                </pre>
            ),
            table: ({ children }) => (
                <div className="overflow-x-auto">
                    <table className="border-collapse text-xs sm:text-sm">{children}</table>
                </div>
            ),
            th: ({ children }) => (
                <th className="border border-border px-2 py-1 text-left font-medium">
                    {children}
                </th>
            ),
            td: ({ children }) => (
                <td className="border border-border px-2 py-1">{children}</td>
            ),
        }}
    >
        {text}
    </ReactMarkdown>
);

export default MarkdownText;
