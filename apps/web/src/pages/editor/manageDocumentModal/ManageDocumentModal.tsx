import useManageDocumentModal from "../../../hooks/useManageDocumentModal";
import OverviewTab from "./overviewTab/OverviewTab";
import ManageAccessTab from "./manageAccessTab/ManageAccessTab";

/**
 * Modal for document-level settings and actions. On mobile it renders as a
 * bottom sheet with a swipe-down-to-dismiss gesture; on sm+ it renders as a
 * centred dialog. Closes on Escape, backdrop click, or swipe down.
 */
const ManageDocumentModal = ({
    onClose,
    documentId,
}: {
    /** Called when the user dismisses the modal. */
    onClose: () => void;
    /** ID of the document being managed, passed to DeleteConfirmationModal. */
    documentId: string | undefined;
}) => {
    const {
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        selectedTab,
        setSelectedTab,
        isDragging,
        dragOffset,
        TABS,
    } = useManageDocumentModal({ onClose, documentId });

    return (
        <>
            {/* Backdrop — click outside the panel to close */}
            <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
                onClick={onClose}
            >
                {/* Panel — stop backdrop-click from propagating */}
                <div
                    className="bg-background-base w-full sm:max-w-4xl sm:mx-4
                    rounded-t-2xl sm:rounded-xl
                    h-[94dvh] sm:h-auto sm:max-h-[80vh]
                    flex flex-col overflow-hidden"
                    style={{
                        transform: `translateY(${dragOffset}px)`,
                        transition: isDragging.current
                            ? "none"
                            : "transform 0.2s ease",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Drag handle — touch target for swipe-down-to-dismiss on mobile */}
                    <div
                        className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden cursor-grab active:cursor-grabbing"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="w-10 h-1 rounded-full bg-background-hover" />
                    </div>

                    {/* Content area */}
                    <div className="flex flex-col sm:flex-row min-h-[500px] h-full">
                        <div className="flex flex-row sm:flex-col shrink-0 p-2 gap-1">
                            {TABS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTab(key)}
                                    className={`text-text-secondary text-sm sm:pl-3 sm:pr-6 px-2 py-2 cursor-pointer
                                    border-none text-start rounded-lg transition
                                    ${selectedTab === key ? "bg-background-elevated" : "bg-transparent hover:opacity-80 active:opacity-75"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="h-[1px] w-full sm:h-auto sm:w-[1px] bg-background-elevated shrink-0" />
                        <div className="flex-1 bg-background-base flex flex-col px-4 py-3 sm:px-6 sm:py-5">
                            {selectedTab === "overview" && (
                                <OverviewTab
                                    documentId={documentId}
                                    onClose={onClose}
                                />
                            )}
                            {selectedTab === "manage-access" && (
                                <ManageAccessTab documentId={documentId} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ManageDocumentModal;
