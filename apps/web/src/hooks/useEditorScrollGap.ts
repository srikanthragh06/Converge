import { type BlockNoteEditor } from "@blocknote/core";
import { useEffect, useRef } from "react";

/**
 * Returns a ref to attach to the editor's scroll container. After every
 * content change, if the cursor is within `gap` pixels of the bottom, the
 * container is nudged down to preserve that gap.
 *
 * ProseMirror's scrollIntoView only ensures the cursor is barely visible —
 * it does not preserve trailing whitespace below the active block.
 */
const useEditorScrollGap = (
    editor: BlockNoteEditor | undefined | null,
    gap = 128,
) => {
    const scrollRef = useRef<HTMLDivElement>(null); // ref to the scrollable container wrapping BlockNoteView

    // Nudges the scroll container after every content change so there is always
    // `gap` pixels of space below the last visible block.
    useEffect(() => {
        if (!editor) return;
        return editor.onChange(() => {
            const container = scrollRef.current;
            if (!container) return;
            const distanceFromBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight;
            if (distanceFromBottom < gap) {
                container.scrollTop =
                    container.scrollHeight - container.clientHeight + gap;
            }
        });
    }, [editor, gap]);

    return scrollRef;
};

export default useEditorScrollGap;
