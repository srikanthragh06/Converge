/** Query keys for version history (document checkpoints). */
export const checkpointKeys = {
    /** Every checkpoint query. */
    all: ["checkpoints"] as const,
    /** One document's checkpoint list (paginated). */
    list: (documentId: number) => ["checkpoints", "list", documentId] as const,
    /** One checkpoint's content, for the diff and restore preview. */
    content: (documentId: number, checkpointId: number) =>
        ["checkpoints", "content", documentId, checkpointId] as const,
};
