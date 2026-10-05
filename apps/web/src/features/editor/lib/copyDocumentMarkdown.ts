import type { EditorInstance } from "@/features/editor/lib/checkpointDiffUtils";
import { showToast } from "@/lib/toast";

/**
 * Copies the whole document as Markdown, headed by its title. Lossy:
 * colors, highlights and alignment are dropped.
 * @param editor - the live editor whose content is copied
 * @param title - the document's title, written as a top-level heading
 */
export const copyDocumentMarkdown = async (
    editor: EditorInstance,
    title: string,
) => {
    const body = editor.blocksToMarkdownLossy();
    const markdown = title ? `# ${title}\n\n${body}` : body;
    try {
        await navigator.clipboard.writeText(markdown);
        showToast("Copied as Markdown");
    } catch (err) {
        console.error("copyDocumentMarkdown: copy failed", err);
        showToast("Couldn't copy the document", { tone: "error" });
    }
};
