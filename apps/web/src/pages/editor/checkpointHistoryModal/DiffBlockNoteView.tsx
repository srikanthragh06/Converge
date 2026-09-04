import { useMemo } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../../theme/editorTheme";
import { colors } from "../../../theme/colors";
import { editorSchema } from "@converge/shared";
import type { UnifiedBlockEntry } from "../../../utils/checkpointDiffUtils";

/** Background tint applied to added/removed rows; unchanged rows get no tint. */
const STATUS_COLORS: Record<"added" | "removed", string> = {
    added: colors.highlights.green.background,
    removed: colors.highlights.red.background,
};

/**
 * Renders a unified diff's entries as a single read-only BlockNoteView, with
 * added/removed blocks tinted green/red. Builds a throwaway editor from the
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

    // CSS rules tinting each added/removed block, targeted by its data-id attribute.
    const statusStyles = entries
        .filter(
            (e): e is UnifiedBlockEntry & { status: "added" | "removed" } =>
                e.status !== "unchanged",
        )
        .map(
            (e) =>
                `[data-checkpoint-diff-view] [data-id="${e.renderId}"] { background: ${STATUS_COLORS[e.status]}; border-radius: 4px; }`,
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
