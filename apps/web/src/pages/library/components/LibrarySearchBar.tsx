/**
 * Search bar row for the library page. Contains a text input for filtering
 * documents by title and a "New Document" button.
 */
const LibrarySearchBar = ({
    value,
    onChange,
    onNewDocument,
}: {
    value: string; // current search query
    onChange: (value: string) => void; // called on every keystroke
    onNewDocument: () => void; // called when the user clicks "New Document"
}) => {
    return (
        <div className="flex gap-3 w-full">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search docs..."
                className="flex-1 px-4 py-2 rounded-lg bg-background-elevated border border-border text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent-blue transition-colors"
            />
            <button
                onClick={onNewDocument}
                className="px-4 py-2 rounded-lg bg-background-elevated border border-border text-text-primary hover:bg-background-hover transition-colors whitespace-nowrap"
            >
                New Document
            </button>
        </div>
    );
};

export default LibrarySearchBar;
