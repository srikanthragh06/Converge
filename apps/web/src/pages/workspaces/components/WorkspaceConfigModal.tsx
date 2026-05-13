import { IoMdCloseCircleOutline } from "react-icons/io";

/**
 * Workspace configuration modal. Shell with backdrop and close — content
 * will be added in subsequent iterations.
 */
const WorkspaceConfigModal = ({
    workspaceId,
    onClose,
}: {
    workspaceId: number;
    onClose: () => void;
}) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-background-base w-full sm:max-w-4xl sm:mx-4
                rounded-xl h-[80dvh] sm:h-[70vh]
                flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-end p-2 sm:p-3">
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="opacity-60 hover:opacity-100 transition cursor-pointer"
                    >
                        <IoMdCloseCircleOutline className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center text-sm opacity-40">
                    Content coming soon
                </div>
            </div>
        </div>
    );
};

export default WorkspaceConfigModal;
