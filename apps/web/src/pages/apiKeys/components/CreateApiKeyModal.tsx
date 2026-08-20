import { useState } from "react";

/**
 * Modal dialog for creating a new API key. Shows a text input for the
 * key's label and Create/Cancel buttons. Calls onCreate with the label
 * on confirmation, and onCancel to dismiss. Closes on backdrop click.
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
    const [label, setLabel] = useState(""); // Current value of the label input.

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = label.trim();
        if (trimmed) onCreate(trimmed);
    };

    return (
        // Backdrop — click outside to cancel
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
            onClick={onCancel}
        >
            {/* Dialog panel */}
            <div
                className="bg-background-base rounded-xl px-6 py-5 w-full max-w-sm mx-4 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-white text-lg font-semibold">
                    New API Key
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="e.g. Claude Code - laptop"
                        autoFocus
                        maxLength={64}
                        className="w-full px-3 py-1.5 text-sm rounded-md
                            bg-background-base outline-none text-white border
                            border-border/70 focus:border-white/30 transition
                            placeholder:text-text-disabled"
                    />

                    {error && <p className="text-red-400 text-xs">{error}</p>}

                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isCreating}
                            className="px-3 py-1.5 text-sm rounded-md bg-transparent
                                text-text-secondary cursor-pointer hover:opacity-80
                                active:opacity-70 transition disabled:opacity-40
                                disabled:cursor-not-allowed border-none"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || !label.trim()}
                            className="px-3 py-1.5 text-sm rounded-md bg-white
                                text-black border-none cursor-pointer
                                hover:opacity-80 active:opacity-70 transition
                                disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isCreating ? "Creating..." : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateApiKeyModal;
