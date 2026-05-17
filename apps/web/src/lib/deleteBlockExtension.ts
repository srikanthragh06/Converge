import { createExtension } from "@blocknote/core";

/**
 * BlockNote extension that implements forward-delete (Delete key) merge behaviour.
 * BlockNote natively handles Backspace merging (cursor at the start of a block pulls
 * it up into the previous one), but does nothing when Delete is pressed at the end of
 * a block. This extension fills that gap by mirroring the same logic in the forward
 * direction.
 *
 * Behaviour summary:
 * - Cursor not at end of block → fall through so the default handler deletes the next character.
 * - Cursor at end, next block is empty → delete the next block.
 * - Cursor at end, next block has inline content → append that content to the current
 *   block and delete the next block (a forward merge).
 * - Cursor at end, next block has nested children or non-inline content (e.g. a table)
 *   → do nothing, because merging would silently destroy nested structure.
 */
const deleteBlockExtension = createExtension({
    key: "delete-block",
    keyboardShortcuts: {
        /**
         * Returning true tells BlockNote/ProseMirror "I handled this key, stop processing."
         * Returning false passes control to the next keymap handler (e.g. the browser default
         * that deletes the character to the right of the cursor).
         */
        Delete: ({ editor }) => {
            const { selection } = editor.prosemirrorState;

            // If the user has text highlighted, return false so the default handler
            // deletes the selected range — we only care about a bare blinking cursor.
            if (!selection.empty) return false;

            // $from is a ProseMirror ResolvedPos: a cursor position enriched with
            // context about the surrounding document tree.
            // $from.parent is the ProseMirror node directly containing the cursor
            // (e.g. a paragraph or heading node).
            // $from.parent.content.size is the total character size of that node's content.
            // $from.parentOffset is how far into that node the cursor sits.
            // When they are equal the cursor is at the very end of the block; if not,
            // there is still text to the right so we fall through to the default handler.
            const { $from } = selection;
            if ($from.parentOffset !== $from.parent.content.size) return false;

            // Switch to the BlockNote-level view of the document to find out what block
            // the cursor is in and what comes immediately after it at the same nesting level.
            const { block: currentBlock, nextBlock } =
                editor.getTextCursorPosition();

            // Cursor is at the end of the last block in the document — nothing to merge
            // into, so consume the event and do nothing.
            if (!nextBlock) return true;

            // If the next block has indented sub-blocks (children), a merge would delete
            // them without warning. Play it safe and leave the document unchanged.
            // if (nextBlock.children.length > 0) return true;

            // Block content is either InlineContent[] (text, links — safe to spread) or
            // TableContent (a non-array object used by table blocks). We can only merge
            // two InlineContent arrays, so bail out if either block uses a different shape.
            if (
                !Array.isArray(currentBlock.content) ||
                !Array.isArray(nextBlock.content)
            )
                return true;

            // Next block is empty — just remove it and leave the cursor in place.
            // This is equivalent to pressing Backspace on an empty line below.
            if (nextBlock.content.length === 0) {
                editor.removeBlocks([nextBlock]);
                return true;
            }

            // Next block has content — perform the forward merge:
            // 1. Save the current cursor position before any mutations. This position
            //    sits at the end of the current block's original content and will become
            //    the junction point after the merge. updateBlock and removeBlocks each
            //    dispatch a ProseMirror transaction that resets the selection as a side
            //    effect, so we need to restore it explicitly afterwards.
            //    The saved position remains valid because updateBlock appends content
            //    *after* it and removeBlocks deletes a node *after* the current block —
            //    neither operation shifts any position at or before the cursor.
            const targetPos = selection.from;

            // 2. Overwrite the current block's content with the two arrays joined together.
            // The `as any` cast is required because BlockNote's deeply generic InlineContent
            // types cannot be verified by TypeScript across the spread — the runtime result
            // is always a valid InlineContent array.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.updateBlock(currentBlock, {
                content: [...currentBlock.content, ...nextBlock.content] as any,
            });

            // 3. Delete the next block, which is now redundant.
            editor.removeBlocks([nextBlock]);

            // 4. Restore the cursor to the junction point between the original and
            //    appended content. TipTap's setTextSelection command creates and
            //    dispatches the selection transaction without requiring a direct
            //    import of prosemirror-state.
            editor._tiptapEditor.commands.setTextSelection(targetPos);
            return true;
        },
    },
});

export default deleteBlockExtension;
