import { useState } from "react";
import DocumentAccessUserCard from "../../../../components/DocumentAccessUserCard";
import useManageAccessTab from "../../../../hooks/useManageAccessTab";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

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
    const [email, setEmail] = useState(""); // current email search query
    const {
        existingUsers,
        foundUser,
        isExistingUsersLoading,
        isFindNewUserLoading,
    } = useManageAccessTab({ documentId, email });

    return (
        <>
            <div className="text-base sm:text-xl mb-4 sm:mb-6">
                Manage Access
            </div>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Add access by email"
                className="w-full px-4 py-2 rounded-lg bg-background-elevated text-white
                max-w-[300px] focus:outline-none
                border-none"
            />
            {isFindNewUserLoading && (
                <AiOutlineLoading3Quarters className="animate-spin mt-4" />
            )}
            {!isFindNewUserLoading && !foundUser && email.trim().length > 0 && (
                <div
                    className="opacity-50 w-full max-w-[300px] bg-background-overlay px-2 py-1
                rounded-lg text-xs sm:text-sm mt-4"
                >
                    Enter the exact email address of the person you want to
                    share access with.
                </div>
            )}
            {!isFindNewUserLoading && foundUser && (
                <div className="mt-4">
                    <p className="text-xs opacity-50 mb-2">Add User</p>
                    <DocumentAccessUserCard
                        avatarUrl={foundUser.avatarUrl}
                        documentId={documentId}
                        userId={foundUser.id}
                        email={foundUser.email}
                        name={foundUser.name}
                        access="noAccess"
                    />
                </div>
            )}
            <div className="sm:mt-4 mt-1">
                <p className="text-xs opacity-50 mb-2">Existing Access</p>
                {isExistingUsersLoading ? (
                    <AiOutlineLoading3Quarters className="animate-spin mt-2" />
                ) : (
                    <div className="flex flex-col">
                        {existingUsers.map((user) => (
                            <DocumentAccessUserCard
                                key={user.id}
                                avatarUrl={user.avatarUrl}
                                documentId={documentId}
                                access={user.access}
                                userId={user.id}
                                email={user.email}
                                name={user.name}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default ManageAccessTab;
