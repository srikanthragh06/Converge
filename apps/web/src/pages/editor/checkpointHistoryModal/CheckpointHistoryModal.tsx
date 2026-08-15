/**
 * Modal for browsing a document's version-history checkpoints. Renders as a
 * centred dialog on all screen sizes. Closes on backdrop click. Not yet
 * functional — no checkpoint list or content wired up.
 */
const CheckpointHistoryModal = ({
    onClose,
}: {
    /** Called when the user dismisses the modal. */
    onClose: () => void;
}) => {
    return (
        <>
            {/* Backdrop — click outside the panel to close */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={onClose}
            >
                {/* Panel — stop backdrop-click from propagating */}
                <div
                    className="bg-background-base w-full sm:max-w-4xl sm:mx-4
                    rounded-xl
                    h-[80dvh] sm:h-[70vh]
                    flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Body — placeholder until the checkpoint list is wired up */}
                    <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                        Checkpoint history coming soon.
                    </div>
                </div>
            </div>
        </>
    );
};

export default CheckpointHistoryModal;
