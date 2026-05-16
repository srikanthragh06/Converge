import useManageDocumentModal from "../../../hooks/useManageDocumentModal";
import OverviewTab from "./overviewTab/OverviewTab";
import AccessOverridesTab from "./accessOverridesTab/AccessOverridesTab";

/**
 * Modal for document-level settings and actions. Renders as a centred dialog
 * on all screen sizes. Closes on backdrop click.
 */
const ManageDocumentModal = ({
    onClose,
    documentId,
}: {
    /** Called when the user dismisses the modal. */
    onClose: () => void;
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const { selectedTab, setSelectedTab, TABS } = useManageDocumentModal();

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
                    {/* Content area */}
                    <div className="flex flex-col sm:flex-row h-full">
                        <div
                            className="flex flex-row sm:flex-col shrink-0 p-2 gap-1 overflow-x-auto sm:overflow-x-visible"
                            style={{ scrollbarWidth: "thin" }}
                        >
                            {TABS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTab(key)}
                                    className={`shrink-0 text-text-secondary text-sm sm:pl-3 sm:pr-6 px-2 py-2 cursor-pointer
                                    border-none text-start rounded-lg transition
                                    ${selectedTab === key ? "bg-background-elevated" : "bg-transparent hover:opacity-80 active:opacity-75"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="h-[1px] w-full sm:h-auto sm:w-[1px] bg-background-elevated shrink-0" />
                        <div className="flex-1 min-h-0 bg-background-base flex flex-col px-4 py-3 sm:px-6 sm:py-5">
                            {selectedTab === "overview" && (
                                <OverviewTab
                                    documentId={documentId}
                                    onClose={onClose}
                                />
                            )}
                            {selectedTab === "access-overrides" && (
                                <AccessOverridesTab documentId={documentId} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ManageDocumentModal;
