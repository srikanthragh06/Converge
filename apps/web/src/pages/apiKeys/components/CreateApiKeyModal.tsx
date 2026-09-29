import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import ModalFooter from "../../../components/ui/ModalFooter";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

/**
 * New API key dialog (pp 34 / 42): a Key name field with Cancel and Create
 * key. Calls onCreate with the trimmed name on submit, and onCancel on
 * Cancel, Escape, the close button, or a backdrop click — except while the
 * request is in flight.
 */
const CreateApiKeyModal = ({
    onCreate,
    onCancel,
    isCreating,
    error,
}: {
    /** Called with the trimmed label when the user confirms. */
    onCreate: (label: string) => void;
    /** Called when the user cancels or dismisses the dialog. */
    onCancel: () => void;
    /** True while the create request is in flight. */
    isCreating: boolean;
    /** Optional server error message shown below the input. */
    error: string | null;
}) => {
    const [label, setLabel] = useState(""); // key name typed so far

    /**
     * Submits the trimmed name; no-ops while it's empty.
     * @param e - the form submit event
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = label.trim();
        if (trimmed) onCreate(trimmed);
    };

    return (
        <Modal
            onClose={onCancel}
            title="New API key"
            description="Name it after where you'll use it, so you can tell keys apart later."
            dismissible={!isCreating}
            size="md"
            className="sm:max-w-[32rem]"
        >
            <form onSubmit={handleSubmit} className="flex flex-col">
                <label
                    htmlFor="api-key-name"
                    className="mb-1.5 mt-2 text-[13px] font-medium text-fg-secondary"
                >
                    Key name
                </label>
                <Input
                    id="api-key-name"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Claude Code - laptop"
                    autoFocus
                    maxLength={64}
                    invalid={!!error}
                />
                {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
                <ModalFooter>
                    <Button onClick={onCancel} disabled={isCreating}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isCreating || !label.trim()}
                    >
                        {isCreating ? "Creating…" : "Create key"}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
};

export default CreateApiKeyModal;
