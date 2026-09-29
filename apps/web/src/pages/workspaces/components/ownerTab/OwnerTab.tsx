import { useAtomValue } from "jotai";
import { LuCrown, LuUserPlus } from "react-icons/lu";
import { authAtom } from "../../../../atoms/auth";
import useWorkspaceOwnerTab from "../../../../hooks/useWorkspaceOwnerTab";
import { Avatar } from "../../../../components/ui/Avatar";
import Button from "../../../../components/ui/Button";
import Input from "../../../../components/ui/Input";
import Skeleton from "../../../../components/ui/Skeleton";
import DelayedRender from "../../../../components/DelayedRender";
import EmailNotice from "../../../../components/people/EmailNotice";

/**
 * Ownership tab of workspace settings (pp 21 / 28): the current owner, and
 * for the owner of a team workspace a Transfer ownership card — the new
 * owner's email, the person found, and the workspace name typed to confirm
 * before the red Transfer ownership button enables. Any Converge account
 * can become the owner.
 * @param workspaceId - the workspace being configured
 * @param workspaceName - must be typed to confirm a transfer
 * @param isOwner - whether the caller owns the workspace
 * @param isPersonal - personal workspaces can't be transferred
 * @param onTransferred - called after a successful transfer
 */
const OwnerTab = ({
    workspaceId,
    workspaceName,
    isOwner,
    isPersonal,
    onTransferred,
}: {
    workspaceId: number;
    workspaceName: string;
    isOwner: boolean;
    isPersonal: boolean;
    onTransferred: () => void;
}) => {
    const canTransfer = isOwner && !isPersonal;
    const {
        owner,
        email,
        setEmail,
        lookup,
        confirmText,
        setConfirmText,
        canSubmit,
        isTransferring,
        transferOwner,
    } = useWorkspaceOwnerTab({
        workspaceId,
        workspaceName,
        canTransfer,
        onTransferred,
    });
    const userEmail = useAtomValue(authAtom).user?.email; // marks the owner as "(you)"

    return (
        <div className="flex flex-col">
            {/* Current owner */}
            {owner ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-inset px-4 py-3">
                    <Avatar
                        name={owner.name}
                        src={owner.avatarUrl}
                        colorKey={owner.email}
                        className="h-8 w-8 text-xs"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-fg">
                            {owner.name}
                            {owner.email === userEmail && " (you)"}
                        </span>
                        <span className="text-xs text-fg-muted">
                            Current owner
                        </span>
                    </div>
                    <LuCrown
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-gold"
                    />
                </div>
            ) : (
                <DelayedRender>
                    <Skeleton height="3.75rem" />
                </DelayedRender>
            )}

            {isOwner && isPersonal && (
                <p className="mt-4 text-sm text-fg-muted">
                    Personal workspaces can't be transferred.
                </p>
            )}

            {canTransfer && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        transferOwner();
                    }}
                    className="mt-6 flex flex-col rounded-xl border border-danger/60 p-5"
                >
                    <span className="text-sm font-semibold text-fg">
                        Transfer ownership
                    </span>
                    <span className="mt-1 text-sm text-fg-muted">
                        The new owner gets full control. You'll become an admin
                        and can't undo this yourself.
                    </span>

                    <label
                        htmlFor="new-owner-email"
                        className="mb-1.5 mt-4 text-[13px] font-medium text-fg-secondary"
                    >
                        New owner's email
                    </label>
                    <Input
                        id="new-owner-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<LuUserPlus />}
                        inputSize="lg"
                        disabled={isTransferring}
                    />
                    {lookup.status === "loading" && (
                        <DelayedRender>
                            <Skeleton height="3.75rem" className="mt-2" />
                        </DelayedRender>
                    )}
                    {lookup.status === "found" && (
                        <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-surface-inset p-3">
                            <Avatar
                                name={lookup.user.name}
                                src={lookup.user.avatarUrl}
                                colorKey={lookup.user.email}
                                className="h-8 w-8 text-xs"
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm text-fg">
                                    {lookup.user.name}
                                </span>
                                <span className="truncate text-xs text-fg-muted">
                                    {lookup.user.email}
                                </span>
                            </div>
                            <span className="shrink-0 text-sm font-medium text-gold">
                                New owner
                            </span>
                        </div>
                    )}
                    {lookup.status === "notFound" && (
                        <EmailNotice title="No Converge account with this email">
                            Check the spelling. They need to sign in to Converge
                            once before they can own a workspace.
                        </EmailNotice>
                    )}
                    {lookup.status === "isOwner" && (
                        <EmailNotice title="That's you">
                            You already own this workspace.
                        </EmailNotice>
                    )}

                    <label
                        htmlFor="transfer-confirm"
                        className="mb-1.5 mt-5 text-[13px] text-fg-secondary"
                    >
                        Type{" "}
                        <span className="font-semibold text-fg">
                            {workspaceName}
                        </span>{" "}
                        to confirm
                    </label>
                    <Input
                        id="transfer-confirm"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        autoComplete="off"
                        disabled={isTransferring}
                        className="sm:max-w-[23rem]"
                    />
                    <Button
                        type="submit"
                        variant="destructive-outline"
                        disabled={!canSubmit}
                        className="mt-4 self-start"
                    >
                        {isTransferring
                            ? "Transferring…"
                            : "Transfer ownership"}
                    </Button>
                </form>
            )}
        </div>
    );
};

export default OwnerTab;
