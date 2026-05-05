/**
 * Default Access tab content for ManageDocumentModal. Displays and manages
 * the fallback access level applied to users with no explicit access entry.
 */
const DefaultAccessTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    return (
        <>
            <div className="text-base sm:text-xl mb-3 sm:mb-6">
                Default Access
            </div>
        </>
    );
};

export default DefaultAccessTab;
