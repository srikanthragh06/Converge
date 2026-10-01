import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import ModalFooter from "../../../components/ui/ModalFooter";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

/**
 * New workspace dialog (pp 32 / 40): a name field with Cancel and Create
 * workspace. Calls onCreate with the trimmed name on submit (Enter or the
 * button), and onCancel on Cancel, Escape, the close button, or a backdrop
 * click — except while the request is in flight.
 */
const CreateWorkspaceModal = ({
    onCreate,
    onCancel,
    isCreating,
}: {
    /** Called with the trimmed workspace name when the user confirms. */
    onCreate: (name: string) => void;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
    /** True while the create request is in flight. */
    isCreating: boolean;
}) => {
    const [name, setName] = useState(""); // workspace name typed so far

    /**
     * Submits the trimmed name; no-ops while it's empty.
     * @param e - the form submit event
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed) onCreate(trimmed);
    };

    return (
        <Modal
            onClose={onCancel}
            title="New workspace"
            description="You'll be the owner. Add people later from Members & access."
            dismissible={!isCreating}
            size="md"
            className="sm:max-w-[32rem]"
        >
            <form onSubmit={handleSubmit} className="flex flex-col">
                <label
                    htmlFor="new-workspace-name"
                    className="mb-1.5 mt-2 text-[13px] font-medium text-fg-secondary"
                >
                    Workspace name
                </label>
                <Input
                    id="new-workspace-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    maxLength={128}
                />
                <ModalFooter>
                    <Button onClick={onCancel} disabled={isCreating}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isCreating || !name.trim()}
                    >
                        {isCreating ? "Creating…" : "Create workspace"}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
};

export default CreateWorkspaceModal;
