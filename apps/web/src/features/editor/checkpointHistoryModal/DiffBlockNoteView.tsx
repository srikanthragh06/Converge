import { useMemo } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "@/theme/editorTheme";
import { editorSchema } from "@converge/shared";
import type { UnifiedBlockEntry } from "@/features/editor/lib/checkpointDiffUtils";

/** CSS declarations for added/removed blocks: a tint and a text color from the theme variables (so they follow the active theme), and a strikethrough on removed blocks, matching the footer legend. Unchanged blocks get none. */
const STATUS_STYLES: Record<"added" | "removed", string> = {
    added: "background: rgb(var(--diff-added)); color: rgb(var(--diff-added-fg));",
    removed:
        "background: rgb(var(--diff-removed)); color: rgb(var(--diff-removed-fg)); text-decoration: line-through;",
};

/**
 * Renders a unified diff's entries as a single read-only BlockNoteView, with
 * added blocks tinted green with green text and removed blocks tinted red
 * with struck-through red text. Builds a throwaway editor from the
 * entries (keyed by renderId, since a modified block appears as an
 * old/new pair that can't share the real block's ID within one document) and
 * injects per-block background colors via a scoped <style> tag, since
 * BlockNoteView has no per-block style prop.
 */
const DiffBlockNoteView = ({ entries }: { entries: UnifiedBlockEntry[] }) => {
    // Throwaway editor holding the merged diff content; rebuilt whenever entries change.
    const diffEditor = useMemo(
        () =>
            BlockNoteEditor.create({
                schema: editorSchema,
                initialContent: entries.map(({ renderId, block }) => ({
                    ...block,
                    id: renderId,
                })),
            }),
        [entries],
    );

    // CSS rules styling each added/removed block, targeted by its data-id attribute.
    const statusStyles = entries
        .filter(
            (e): e is UnifiedBlockEntry & { status: "added" | "removed" } =>
                e.status !== "unchanged",
        )
        .map(
            (e) =>
                `[data-checkpoint-diff-view] [data-id="${e.renderId}"] { ${STATUS_STYLES[e.status]} border-radius: 4px; }\n` +
                // Content that sets its own color (headings use --fg) inherits the diff color instead.
                `[data-checkpoint-diff-view] [data-id="${e.renderId}"] [data-content-type] { color: inherit; }`,
        )
        .join("\n");

    return (
        <div
            data-checkpoint-diff-view
            className="flex-1 min-h-0 overflow-y-auto overflow-x-auto"
        >
            <style>{statusStyles}</style>
            <BlockNoteView
                editor={diffEditor}
                theme={convergeTheme}
                editable={false}
            />
        </div>
    );
};

export default DiffBlockNoteView;
