import { useLayoutEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { awarenessAtom } from "../../../atoms/socket";
import { authAtom } from "../../../atoms/auth";
import { type AwarenessUser } from "@converge/shared";
import { Avatar } from "../../../components/ui/Avatar";
import Tooltip from "../../../components/ui/Tooltip";

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
 * Marks each block another user is focused on: a faint tint of their presence
 * color behind the block's text (all widths), and their avatar in the right
 * gutter (desktop only — phones have no gutter). The tint is the presence
 * color at low opacity, so the same server-assigned color reads on both the
 * light and dark page. Everything is absolutely positioned inside the editor
 * wrapper so it scrolls with the content and needs no scroll listeners —
 * offsetTop is scroll-independent.
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
        <div className="pointer-events-none absolute inset-0">
            {/* Block tints, in the first focused user's color. Inset to the text
                column (BlockNote's 54px / 20px gutters) plus a little breathing room. */}
            {blockPositions.map(({ blockId, top, height, users }) => (
                <div
                    key={`tint-${blockId}`}
                    className="absolute inset-x-3 rounded-md sm:inset-x-[46px]"
                    style={{
                        top,
                        height,
                        backgroundColor: `color-mix(in srgb, ${users[0].color} 12%, transparent)`,
                    }}
                />
            ))}
            {blockPositions.map(({ blockId, top, height, users }) => (
                // Vertically centred on the block, in the right gutter.
                <div
                    key={blockId}
                    className="absolute right-3 hidden flex-col gap-1 sm:flex"
                    style={{ top: top + height / 2 - 12 }}
                >
                    {users.map((user) => (
                        <Tooltip
                            key={user.userId}
                            side="left"
                            content={
                                <>
                                    <p className="font-medium text-sm">
                                        {user.name}
                                    </p>
                                    <p className="opacity-70">{user.email}</p>
                                    <p className="opacity-50 capitalize mt-0.5">
                                        {user.accessLevel}
                                    </p>
                                </>
                            }
                        >
                            <Avatar
                                name={user.name}
                                src={user.avatarUrl}
                                colorKey={String(user.userId)}
                                ringColor={user.color}
                                className="pointer-events-auto ring-2 ring-surface"
                            />
                        </Tooltip>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default BlockAwarenessOverlay;
