import { RxAvatar } from "react-icons/rx";
import useWorkspaceOwnerTab from "../../../../hooks/useWorkspaceOwnerTab";
import TransferOwnerConfirmationModal from "./TransferOwnerConfirmationModal";
import { Skeleton } from "primereact/skeleton";
import DelayedRender from "../../../../components/DelayedRender";

/**
 * Owner tab content for WorkspaceConfigModal. Displays the current workspace
 * owner and, for the owner only, allows transferring ownership to any user by
 * exact email address. The target need not be an existing workspace member.
 */
const OwnerTab = ({ workspaceId }: { workspaceId: number }) => {
    const {
        owner,
        isOwnerLoading,
        isRoleLoading,
        isTypeLoading,
        isOwner,
        isPersonal,
        email,
        setEmail,
        foundUser,
        isFindLoading,
        isFindConflict,
        isTransferConfirmOpen,
        setIsTransferConfirmOpen,
        isTransferring,
        transferOwner,
    } = useWorkspaceOwnerTab({ workspaceId });

    return (
        <>
            {/* Current owner card */}
            {isOwnerLoading ? (
                <DelayedRender>
                    <div className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2">
                        <Skeleton shape="circle" size="2rem" />
                        <div className="flex flex-col gap-1.5 flex-1">
                            <Skeleton height="0.875rem" width="45%" />
                            <Skeleton height="0.75rem" width="60%" />
                        </div>
                    </div>
                </DelayedRender>
            ) : (
                owner && (
                    <div className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2">
                        {owner.avatarUrl ? (
                            <img
                                referrerPolicy="no-referrer"
                                src={owner.avatarUrl}
                                alt={owner.name}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                            />
                        ) : (
                            <RxAvatar className="w-7 h-7 sm:w-8 sm:h-8 text-text-secondary shrink-0" />
                        )}
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs sm:text-sm text-text-primary truncate">
                                {owner.name}
                            </span>
                            <span className="text-xs text-text-secondary truncate">
                                {owner.email}
                            </span>
                        </div>
                        <span className="shrink-0 text-xs sm:text-sm text-text-secondary opacity-50 px-1.5 sm:px-2 py-0.5 sm:py-1">
                            Owner
                        </span>
                    </div>
                )
            )}

            {/* Personal workspace notice — transfer is not available */}
            {!isRoleLoading && !isTypeLoading && isOwner && isPersonal && (
                <p className="text-xs opacity-50 mt-3 sm:mt-4">
                    Ownership cannot be transferred for personal workspaces.
                </p>
            )}

            {/* Transfer ownership section — only visible to the owner of a custom workspace */}
            {!isRoleLoading && !isTypeLoading && isOwner && !isPersonal && (
                <>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Transfer ownership by email"
                        className="w-full mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-background-elevated
                        text-sm text-white focus:outline-none border-none"
                    />

                    {isFindLoading && (
                        <DelayedRender>
                            <Skeleton height="3rem" width="100%" className="mt-3 sm:mt-4" />
                        </DelayedRender>
                    )}

                    {!isFindLoading &&
                        isFindConflict &&
                        email.trim().length > 0 && (
                            <div
                                className="opacity-50 w-full bg-background-overlay px-2 py-1
                                rounded-lg text-xs mt-3 sm:mt-4"
                            >
                                You are already the workspace owner.
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
                                Enter the exact email address of the user you
                                want to transfer ownership to.
                            </div>
                        )}

                    {/* Transfer candidate card — clicking opens the confirmation modal */}
                    {!isFindLoading && foundUser && (
                        <div className="mt-3 sm:mt-4">
                            <p className="text-xs opacity-50 mb-2">
                                Transfer To
                            </p>
                            <div
                                className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 cursor-pointer
                                hover:opacity-90 transition"
                                onClick={() => setIsTransferConfirmOpen(true)}
                            >
                                {foundUser.avatarUrl ? (
                                    <img
                                        referrerPolicy="no-referrer"
                                        src={foundUser.avatarUrl}
                                        alt={foundUser.name}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                                    />
                                ) : (
                                    <RxAvatar className="w-7 h-7 sm:w-8 sm:h-8 text-text-secondary shrink-0" />
                                )}
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-xs sm:text-sm text-text-primary truncate">
                                        {foundUser.name}
                                    </span>
                                    <span className="text-xs text-text-secondary truncate">
                                        {foundUser.email}
                                    </span>
                                </div>
                            </div>
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
            )}
        </>
    );
};

export default OwnerTab;
