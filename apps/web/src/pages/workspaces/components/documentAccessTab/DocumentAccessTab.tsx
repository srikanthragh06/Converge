/** Tab for configuring the document access level for the workspace. */
const DocumentAccessTab = ({ workspaceId }: { workspaceId: number }) => {
    return (
        <div>
            <p className="text-white sm:text-sm text-xs opacity-50">
                Controls the default access level workspace members have on
                documents based on their workspace role. For per-document
                permissions, configure access within the document itself.
            </p>
        </div>
    );
};

export default DocumentAccessTab;
