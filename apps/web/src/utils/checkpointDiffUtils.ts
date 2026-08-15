import type useEditor from "../hooks/useEditor";

/** The live editor instance's type, reused so decoded checkpoint content is typed identically. */
export type EditorInstance = NonNullable<
    ReturnType<typeof useEditor>["editor"]
>;
/** A single BlockNote block, as returned by editor.document. */
export type DocBlock = EditorInstance["document"][number]; // [number] gives element type of an array type

/** Whether a block in the unified diff is unchanged, newly present, or no longer present. */
export type DiffStatus = "unchanged" | "added" | "removed";

/** One block in the unified, ordered diff sequence. */
export interface UnifiedBlockEntry {
    /** ID to use when rendering this block in the synthetic diff editor. Usually
     * the block's real ID, except the "old" half of a modified pair — which gets
     * a synthetic suffixed ID so it can coexist with the "new" half's real ID
     * in the same rendered document. */
    renderId: string;
    status: DiffStatus;
    block: DocBlock;
}

/** Stringifies everything about a block except its ID, so equality checks also catch changes to nested children/props, not just top-level content. */
const blockSignature = (block: DocBlock): string =>
    JSON.stringify({
        type: block.type,
        props: block.props,
        content: block.content,
        children: block.children,
    });

/**
 * Builds the standard LCS (longest common subsequence) table for two ID
 * sequences — the same alignment technique git uses to match up lines
 * between two versions of a file, applied here to block IDs instead of
 * lines of text.
 */
const buildLcsTable = (a: string[], b: string[]): number[][] => {
    const n = a.length;
    const m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
        new Array(m + 1).fill(0),
    );
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] =
                a[i] === b[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    return dp;
};

type SequenceOp =
    | { kind: "same"; oldIndex: number; newIndex: number }
    | { kind: "removed"; oldIndex: number }
    | { kind: "added"; newIndex: number };

/**
 * Aligns two ordered block-ID sequences using the LCS table above, producing
 * an ordered list of same/added/removed operations — unlike a plain ID-set
 * comparison, this preserves position, so a removed block's op appears at
 * the point in the sequence where it used to sit relative to its neighbors.
 * @param oldIds - block IDs in the earlier state's order
 * @param newIds - block IDs in the later state's order
 * @returns the ordered alignment operations
 */
const diffSequence = (oldIds: string[], newIds: string[]): SequenceOp[] => {
    const dp = buildLcsTable(oldIds, newIds);
    const ops: SequenceOp[] = [];
    let i = 0;
    let j = 0;

    while (i < oldIds.length && j < newIds.length) {
        if (oldIds[i] === newIds[j]) {
            ops.push({ kind: "same", oldIndex: i, newIndex: j });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ kind: "removed", oldIndex: i });
            i++;
        } else {
            ops.push({ kind: "added", newIndex: j });
            j++;
        }
    }
    while (i < oldIds.length) {
        ops.push({ kind: "removed", oldIndex: i });
        i++;
    }
    while (j < newIds.length) {
        ops.push({ kind: "added", newIndex: j });
        j++;
    }
    return ops;
};

/**
 * Builds one unified, ordered list of blocks representing the diff between
 * two document states, git-unified-diff style: an unchanged block appears
 * once, a block present in only one side appears once tagged added/removed,
 * and a modified block appears as an adjacent removed(old)/added(new) pair
 * — matching how a unified text diff shows a changed line as delete+insert.
 * @param oldBlocks - blocks from the earlier state
 * @param newBlocks - blocks from the later state
 * @returns the merged, ordered entries to render
 */
export const buildUnifiedDiff = (
    oldBlocks: DocBlock[],
    newBlocks: DocBlock[],
): UnifiedBlockEntry[] => {
    const ops = diffSequence(
        oldBlocks.map((b) => b.id),
        newBlocks.map((b) => b.id),
    );
    const entries: UnifiedBlockEntry[] = [];

    for (const op of ops) {
        if (op.kind === "same") {
            const oldBlock = oldBlocks[op.oldIndex];
            const newBlock = newBlocks[op.newIndex];
            if (blockSignature(oldBlock) === blockSignature(newBlock)) {
                entries.push({
                    renderId: newBlock.id,
                    status: "unchanged",
                    block: newBlock,
                });
            } else {
                // Same block, different content — represent as delete-then-insert,
                // matching a git unified diff's treatment of a changed line. The old
                // half needs a synthetic ID since it can't share newBlock's real ID
                // within the same rendered document.
                entries.push({
                    renderId: `${oldBlock.id}__old`,
                    status: "removed",
                    block: oldBlock,
                });
                entries.push({
                    renderId: newBlock.id,
                    status: "added",
                    block: newBlock,
                });
            }
        } else if (op.kind === "removed") {
            const block = oldBlocks[op.oldIndex];
            entries.push({ renderId: block.id, status: "removed", block });
        } else {
            const block = newBlocks[op.newIndex];
            entries.push({ renderId: block.id, status: "added", block });
        }
    }
    return entries;
};
