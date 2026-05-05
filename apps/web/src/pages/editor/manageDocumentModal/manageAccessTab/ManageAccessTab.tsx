/**
 * Manage Access tab content for ManageDocumentModal. Displays and manages
 * per-user access levels for the document.
 */
const ManageAccessTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    return (
        <>
            <div className="text-base sm:text-xl mb-4 sm:mb-6">
                Manage Access
            </div>
        </>
    );
};

export default ManageAccessTab;
