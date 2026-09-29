import { useAtomValue } from "jotai";
import { authAtom } from "../../../../atoms/auth";
import useWorkspaceOverview from "../../../../hooks/useWorkspaceOverview";
import { hasWorkspaceRole } from "@converge/shared";
import Button from "../../../../components/ui/Button";
import Input from "../../../../components/ui/Input";
import Skeleton from "../../../../components/ui/Skeleton";
import DelayedRender from "../../../../components/DelayedRender";
import DetailItem from "./DetailItem";
import LeaveWorkspaceConfirmationModal from "./LeaveWorkspaceConfirmationModal";

/** Classes for the inline gold links that jump to another tab. */
const TAB_LINK_CLASSES =
    "cursor-pointer rounded-sm text-gold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-gold/60";

/**
 * General tab of workspace settings (pp 18 / 25): the workspace name (Save
 * appears once it changes; admins and the owner only), a details card, and
 * a Leave workspace card explaining why leaving is blocked when it is.
 * @param settings - the modal's shared useWorkspaceOverview state
 * @param onGoToTab - switches the modal to another tab, e.g. "members"
 */
const GeneralTab = ({
    settings,
    onGoToTab,
}: {
    settings: ReturnType<typeof useWorkspaceOverview>;
    onGoToTab: (tab: "members" | "owner") => void;
}) => {
    const {
        overview,
        role,
        name,
        setName,
        isNameChanged,
        isSaving,
        save,
        isOwner,
        isSelected,
        canLeave,
        isConfirmOpen,
        setIsConfirmOpen,
        isLeaving,
        handleLeave,
    } = settings;
    const userEmail = useAtomValue(authAtom).user?.email; // marks the owner as "(you)"

    if (!overview || !role)
        return (
            <DelayedRender>
                <div className="flex flex-col gap-3">
                    <Skeleton height="1rem" width="8rem" />
                    <Skeleton height="2.5rem" />
                    <Skeleton height="8rem" className="mt-3" />
                    <Skeleton height="5rem" className="mt-2" />
                </div>
            </DelayedRender>
        );

    const canRename = hasWorkspaceRole(role, "admin"); // the server only lets admins and the owner rename
    const isPersonal = overview.type === "personal";

    return (
        <>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
                className="flex flex-col"
            >
                <label
                    htmlFor="workspace-name"
                    className="mb-1.5 text-[13px] font-medium text-fg-secondary"
                >
                    Workspace name
                </label>
                <div className="flex items-center gap-2">
                    <Input
                        id="workspace-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={128}
                        disabled={!canRename || isSaving}
                        inputSize="lg"
                    />
                    {isNameChanged && canRename && (
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSaving}
                            className="h-10 px-4 font-semibold sm:h-11"
                        >
                            {isSaving ? "Saving…" : "Save"}
                        </Button>
                    )}
                </div>
            </form>

            {/* Details card */}
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-surface-inset p-5 sm:grid-cols-3">
                <DetailItem label="Type">
                    {isPersonal ? "Personal workspace" : "Team workspace"}
                </DetailItem>
                <DetailItem label="Owner">
                    {overview.ownerName}
                    {overview.ownerEmail === userEmail && " (you)"}
                </DetailItem>
                <DetailItem label="Created">
                    {new Date(overview.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}
                </DetailItem>
                <DetailItem label="Members">
                    {overview.membersCount} ·{" "}
                    <button
                        type="button"
                        onClick={() => onGoToTab("members")}
                        className={TAB_LINK_CLASSES}
                    >
                        Manage
                    </button>
                </DetailItem>
                <DetailItem label="Documents">
                    {overview.documentsCount}
                </DetailItem>
                <DetailItem label="Your role">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </DetailItem>
            </div>

            {/* Leave card */}
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-line p-5">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-fg">
                        Leave workspace
                    </span>
                    <span className="text-sm text-fg-muted">
                        {isOwner && isPersonal ? (
                            "You can't leave your personal workspace."
                        ) : isOwner ? (
                            <>
                                Owners can't leave.{" "}
                                <button
                                    type="button"
                                    onClick={() => onGoToTab("owner")}
                                    className={TAB_LINK_CLASSES}
                                >
                                    Transfer ownership
                                </button>{" "}
                                first.
                            </>
                        ) : isSelected ? (
                            "Switch to another workspace before leaving this one."
                        ) : (
                            "You'll lose access to its documents until someone adds you again."
                        )}
                    </span>
                </div>
                <Button
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={!canLeave}
                >
                    Leave
                </Button>
            </div>

            {isConfirmOpen && (
                <LeaveWorkspaceConfirmationModal
                    workspaceName={overview.name}
                    onCancel={() => setIsConfirmOpen(false)}
                    onConfirm={handleLeave}
                    isLeaving={isLeaving}
                />
            )}
        </>
    );
};

export default GeneralTab;
