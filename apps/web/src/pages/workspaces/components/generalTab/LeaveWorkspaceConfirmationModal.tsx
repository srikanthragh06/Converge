import { useEffect } from "react";

/**
 * Confirmation modal for leaving a workspace. Shows the workspace name,
 * a warning about needing a new invitation, and Cancel / Leave buttons.
 * Pressing Escape dismisses the modal.
 */
const LeaveWorkspaceConfirmationModal = ({
    workspaceName, // display name shown in the prompt
    onCancel, // closes the modal
    onConfirm, // triggers the leave-workspace POST
    isLeaving, // true while the leave request is in flight
}: {
    workspaceName: string;
    onCancel: () => void;
    onConfirm: () => void;
    isLeaving: boolean;
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay"
            onClick={onCancel}
        >
            <div
                className="bg-surface-elevated rounded-xl px-6 py-5 w-full max-w-sm mx-4 flex flex-col gap-5"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-fg-secondary text-sm">
                    Leave <span className="text-fg">{workspaceName}</span>?
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isLeaving}
                        className="px-3 py-1.5 text-sm rounded-md bg-transparent
                            text-fg-secondary cursor-pointer hover:opacity-80
                            active:opacity-70 transition disabled:opacity-40
                            disabled:cursor-not-allowed border-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLeaving}
                        className="px-3 py-1.5 text-sm rounded-md bg-danger-solid text-danger-solid-fg
                            border-none cursor-pointer hover:opacity-80 active:opacity-70
                            transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isLeaving ? "Leaving..." : "Leave"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeaveWorkspaceConfirmationModal;
