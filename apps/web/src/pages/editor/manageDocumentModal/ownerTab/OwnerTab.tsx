import { AiOutlineLoading3Quarters } from "react-icons/ai";
import DocumentAccessUserCard from "../../../../components/DocumentAccessUserCard";
import useOwnerTab from "../../../../hooks/useOwnerTab";
import TransferOwnerConfirmationModal from "./TransferOwnerConfirmationModal";

/**
 * Owner tab content for ManageDocumentModal. Displays the current document
 * owner and allows the owner to search for a user to transfer ownership to.
 */
const OwnerTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const {
        owner,
        isOwnerLoading,
        email,
        setEmail,
        foundUser,
        isFindLoading,
        isFindConflict,
        isTransferConfirmOpen,
        setIsTransferConfirmOpen,
        isTransferring,
        transferOwner,
    } = useOwnerTab({ documentId });

    return (
        <>
            <div className="text-base sm:text-xl mb-3 sm:mb-6">Owner</div>

            {/* Current owner */}
            {isOwnerLoading ? (
                <AiOutlineLoading3Quarters className="animate-spin" />
            ) : (
                owner && (
                    <DocumentAccessUserCard
                        avatarUrl={owner.avatarUrl}
                        documentId={documentId}
                        userId={owner.id}
                        name={owner.name}
                        email={owner.email}
                        type="owner"
                    />
                )
            )}

            {/* Transfer ownership search */}
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Transfer ownership by email"
                className="w-full mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-background-elevated
                text-sm sm:text-base text-white focus:outline-none border-none"
            />
            {isFindLoading && (
                <AiOutlineLoading3Quarters className="animate-spin mt-3 sm:mt-4" />
            )}
            {!isFindLoading && isFindConflict && email.trim().length > 0 && (
                <div
                    className="opacity-50 w-full bg-background-overlay px-2 py-1
                    rounded-lg text-xs mt-3 sm:mt-4"
                >
                    {email} is already the document owner.
                </div>
            )}
            {!isFindLoading &&
                !isFindConflict &&
                !foundUser &&
                email.trim().length > 0 && (
                    <div
                        className="opacity-50 w-full bg-background-overlay px-2 py-1
                        rounded-lg text-xs mt-3 sm:mt-4"
                    >
                        Enter the exact email address of the person you want to
                        transfer ownership to.
                    </div>
                )}
            {!isFindLoading && foundUser && (
                <div className="mt-3 sm:mt-4">
                    <p className="text-xs opacity-50 mb-2">Transfer To</p>
                    <DocumentAccessUserCard
                        avatarUrl={foundUser.avatarUrl}
                        documentId={documentId}
                        userId={foundUser.id}
                        name={foundUser.name}
                        email={foundUser.email}
                        type="none"
                        onCardClick={() => setIsTransferConfirmOpen(true)}
                    />
                </div>
            )}

            {isTransferConfirmOpen && foundUser && (
                <TransferOwnerConfirmationModal
                    newOwnerName={foundUser.name}
                    onCancel={() => setIsTransferConfirmOpen(false)}
                    onConfirm={transferOwner}
                    isTransferring={isTransferring}
                />
            )}
        </>
    );
};

export default OwnerTab;
