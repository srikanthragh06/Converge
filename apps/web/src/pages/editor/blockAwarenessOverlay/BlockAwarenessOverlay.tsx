import { useLayoutEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { awarenessAtom } from "../../../atoms/socket";
import { authAtom } from "../../../atoms/auth";
import { type AwarenessUser } from "@converge/shared";

/** Position of a block in the editor and the users focused on it. */
type BlockPosition = {
    blockId: string;
    /** offsetTop of the block relative to the editor wrapper div. */
    top: number;
    /** offsetHeight of the block element. */
    height: number;
    /** Users currently focused on this block. */
    users: AwarenessUser[];
};

/**
 * Sums offsetTop up the offsetParent chain from el until ancestor is reached.
 * Returns the element's top position relative to ancestor, independent of scroll.
 * @param el - the element whose position is being measured
 * @param ancestor - the positioned ancestor to measure relative to
 */
function getOffsetTopRelativeTo(
    el: HTMLElement,
    ancestor: HTMLElement,
): number {
    let top = 0;
    let current: HTMLElement | null = el;
    while (current && current !== ancestor) {
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
    }
    return top;
}

/**
 * Renders small avatar indicators next to each block that another user is focused on.
 * Avatars are absolutely positioned inside the editor wrapper so they scroll with content
 * and require no scroll listeners — offsetTop is scroll-independent.
 * @param editorWrapperRef - ref to the position:relative div wrapping BlockNoteView
 */
const BlockAwarenessOverlay = ({
    editorWrapperRef,
}: {
    editorWrapperRef: React.RefObject<HTMLDivElement | null>;
}) => {
    const awareness = useAtomValue(awarenessAtom); // presence list for the current document
    const auth = useAtomValue(authAtom); // current user — used to exclude self

    const [blockPositions, setBlockPositions] = useState<BlockPosition[]>([]); // computed positions of focused blocks

    // Recompute block positions whenever the presence list changes.
    useLayoutEffect(() => {
        const wrapper = editorWrapperRef.current;
        if (!wrapper) return;

        // Exclude self and users who aren't focused on any block.
        const focusedUsers = awareness.filter(
            (u) =>
                u.userId !== Number(auth.user?.id) && u.focusedBlockId !== null,
        );

        // Group users by the block they're focused on.
        const byBlock = new Map<string, AwarenessUser[]>();
        for (const user of focusedUsers) {
            const blockId = user.focusedBlockId!;
            if (!byBlock.has(blockId)) byBlock.set(blockId, []);
            byBlock.get(blockId)!.push(user);
        }

        // Query each block's DOM element and compute its position relative to the wrapper.
        const positions: BlockPosition[] = [];
        for (const [blockId, users] of byBlock) {
            const blockEl = wrapper.querySelector<HTMLElement>(
                `[data-id="${blockId}"]`,
            );
            if (!blockEl) continue;
            positions.push({
                blockId,
                top: getOffsetTopRelativeTo(blockEl, wrapper),
                height: blockEl.offsetHeight,
                users,
            });
        }

        setBlockPositions(positions);
    }, [awareness, auth.user?.id]);

    if (blockPositions.length === 0) return null;

    return (
        // Covers the wrapper exactly; pointer-events:none so clicks pass through to the editor.
        <div className="hidden sm:block absolute inset-0 pointer-events-none">
            {blockPositions.map(({ blockId, top, height, users }) => (
                // Vertically centred on the block, pinned to the right margin.
                <div
                    key={blockId}
                    className="absolute right-2 flex flex-col gap-1"
                    style={{ top: top + height / 2 - 12 }}
                >
                    {users.map((user) => (
                        <div
                            key={user.userId}
                            className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs font-medium"
                            style={{
                                border: `2px solid ${user.color}`,
                                backgroundColor: "#303030",
                            }}
                            title={user.name}
                        >
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    referrerPolicy="no-referrer"
                                    alt={user.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>
                                    {user.name[0]?.toUpperCase() ?? "?"}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default BlockAwarenessOverlay;
