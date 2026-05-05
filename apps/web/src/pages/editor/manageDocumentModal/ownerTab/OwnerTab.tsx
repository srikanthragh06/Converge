/**
 * Owner tab content for ManageDocumentModal. Displays the current document
 * owner and allows the owner to transfer ownership to another user.
 */
const OwnerTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    return (
        <>
            <div className="text-base sm:text-xl mb-3 sm:mb-6">Owner</div>
        </>
    );
};

export default OwnerTab;
