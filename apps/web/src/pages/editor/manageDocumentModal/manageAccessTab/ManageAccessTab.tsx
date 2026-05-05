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
    const { existingUsers, isLoading } = useManageAccessTab({
        documentId,
        email,
    });

    return (
        <>
            <div className="text-base sm:text-xl mb-4 sm:mb-6">
                Manage Access
            </div>
            <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Add access by email"
                className="w-full px-4 py-2 rounded-lg bg-background-elevated text-white
                max-w-[300px] focus:outline-none
                border-none"
            />
            {isLoading && (
                <AiOutlineLoading3Quarters className="animate-spin mt-4" />
            )}
            {!isLoading && email.trim().length > 0 && (
                <div
                    className="opacity-50 w-full max-w-[300px] bg-background-overlay px-2 py-1 
                rounded-lg text-xs sm:text-sm mt-4"
                >
                    Enter the exact email address of the person you want to
                    share access with.
                </div>
            )}
            <div className="sm:mt-4 mt-1">
                <p className="text-xs opacity-50 mb-2">Existing Access</p>
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
            </div>
        </>
    );
};

export default ManageAccessTab;
