import DocumentAccessUserCard from "../../../../components/DocumentAccessUserCard";
import useManageAccessTab from "../../../../hooks/useManageAccessTab";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

/**
 * Manage Access tab content for ManageDocumentModal. Displays and manages
 * per-user access levels for the document. The existing-access card list
 * is independently scrollable and loads additional pages via infinite scroll.
 */
const ManageAccessTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const {
        email,
        setEmail,
        existingUsers,
        setExistingUsers,
        foundUser,
        setFoundUser,
        isExistingUsersLoading,
        isFetchingMore,
        isFindNewUserLoading,
        isFindNewUserConflict,
        sentinelRef,
    } = useManageAccessTab({ documentId });

    return (
        <div className="h-full flex flex-col">
            <div className="text-base sm:text-xl mb-3 sm:mb-6">
                Manage Access
            </div>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Add access by email"
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-background-elevated
                text-sm sm:text-base text-white focus:outline-none border-none"
            />
            {isFindNewUserLoading && (
                <AiOutlineLoading3Quarters className="animate-spin mt-3 sm:mt-4" />
            )}
            {!isFindNewUserLoading &&
                isFindNewUserConflict &&
                email.trim().length > 0 && (
                    <div
                        className="opacity-50 w-full bg-background-overlay px-2 py-1
                rounded-lg text-xs mt-3 sm:mt-4"
                    >
                        {email} is already the owner or has access assigned.
                    </div>
                )}
            {!isFindNewUserLoading &&
                !isFindNewUserConflict &&
                !foundUser &&
                email.trim().length > 0 && (
                    <div
                        className="opacity-50 w-full bg-background-overlay px-2 py-1
                rounded-lg text-xs mt-3 sm:mt-4"
                    >
                        Enter the exact email address of the person you want to
                        share access with.
                    </div>
                )}
            {!isFindNewUserLoading && foundUser && (
                <div className="mt-3 sm:mt-4 shrink-0">
                    <p className="text-xs opacity-50 mb-2">Add User</p>
                    <DocumentAccessUserCard
                        avatarUrl={foundUser.avatarUrl}
                        documentId={documentId}
                        userId={foundUser.id}
                        email={foundUser.email}
                        name={foundUser.name}
                        onAccessChanged={(newAccess) => {
                            setFoundUser(null);
                            setExistingUsers((users) => [
                                { ...foundUser, access: newAccess },
                                ...users,
                            ]);
                        }}
                    />
                </div>
            )}

            {/* Existing access — flex-1 + min-h-0 lets this section shrink and activate overflow-y-auto */}
            <div className="mt-3 sm:mt-4 flex flex-col flex-1 min-h-0">
                <p className="text-xs opacity-50 mb-2 shrink-0">
                    Existing Access
                </p>
                {isExistingUsersLoading ? (
                    <AiOutlineLoading3Quarters className="animate-spin mt-2" />
                ) : (
                    <div
                        className="flex flex-col flex-1 min-h-0 overflow-y-auto"
                        style={{ scrollbarWidth: "thin" }}
                    >
                        {existingUsers.map((existingUser) => (
                            <DocumentAccessUserCard
                                key={existingUser.id}
                                avatarUrl={existingUser.avatarUrl}
                                documentId={documentId}
                                access={existingUser.access}
                                userId={existingUser.id}
                                email={existingUser.email}
                                name={existingUser.name}
                                canDeleteAccess={true}
                                onAccessRemoved={() => {
                                    setExistingUsers((users) =>
                                        users.filter(
                                            (user) =>
                                                user.id !== existingUser.id,
                                        ),
                                    );
                                }}
                            />
                        ))}
                        {/* Sentinel observed by IntersectionObserver to trigger the next page load */}
                        <div
                            ref={sentinelRef}
                            className="border-2 border-solid border-transparent"
                        />
                        {isFetchingMore && (
                            <AiOutlineLoading3Quarters className="animate-spin mx-auto mt-2 mb-1" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageAccessTab;
