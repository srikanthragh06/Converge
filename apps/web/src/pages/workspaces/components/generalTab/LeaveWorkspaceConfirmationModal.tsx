import Modal from "../../../../components/ui/Modal";
import ModalFooter from "../../../../components/ui/ModalFooter";
import Button from "../../../../components/ui/Button";

/**
 * Confirmation before leaving a workspace, with Cancel and a red Leave.
 * @param workspaceName - shown in the title
 * @param onCancel - closes the confirmation
 * @param onConfirm - leaves the workspace
 * @param isLeaving - true while the leave request is in flight; blocks dismissing
 */
const LeaveWorkspaceConfirmationModal = ({
    workspaceName,
    onCancel,
    onConfirm,
    isLeaving,
}: {
    workspaceName: string;
    onCancel: () => void;
    onConfirm: () => void;
    isLeaving: boolean;
}) => (
    <Modal
        onClose={onCancel}
        title={`Leave ${workspaceName}?`}
        description="You'll lose access to its documents until someone adds you again."
        dismissible={!isLeaving}
    >
        <ModalFooter className="mt-3">
            <Button onClick={onCancel} disabled={isLeaving}>
                Cancel
            </Button>
            <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={isLeaving}
            >
                {isLeaving ? "Leaving…" : "Leave"}
            </Button>
        </ModalFooter>
    </Modal>
);

export default LeaveWorkspaceConfirmationModal;
