import { useState } from "react";
import Modal from "../ui/Modal";
import ModalFooter from "../ui/ModalFooter";
import Button from "../ui/Button";

/**
 * Confirmation before a conversation is hard-deleted (conversations have no
 * trash or restore, unlike documents). Escape, the backdrop, and Cancel all
 * call onCancel, except while the delete is in flight.
 * @param onConfirm - deletes the conversation; the modal stays open until it settles
 * @param onCancel - closes the modal without deleting
 */
const DeleteConversationModal = ({
    onConfirm,
    onCancel,
}: {
    onConfirm: () => Promise<void>;
    onCancel: () => void;
}) => {
    const [isDeleting, setIsDeleting] = useState(false); // true while the delete request is in flight, to block a double submit

    /** Runs the delete, keeping the modal open (and its buttons disabled) until it settles. */
    const handleConfirm = async () => {
        setIsDeleting(true);
        await onConfirm();
    };

    return (
        <Modal onClose={onCancel} title="Delete chat" dismissible={!isDeleting}>
            <p className="text-sm text-fg-secondary">
                Delete this conversation? This can't be undone.
            </p>
            <ModalFooter>
                <Button onClick={onCancel} disabled={isDeleting}>
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    onClick={() => void handleConfirm()}
                    disabled={isDeleting}
                >
                    {isDeleting ? "Deleting…" : "Delete"}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default DeleteConversationModal;
