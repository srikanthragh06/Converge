import { useAtomValue } from "jotai";
import type {
    DocumentAccessLevel,
    DocumentAccessUserDto,
} from "@converge/shared";
import { LuLink, LuLock, LuUserPlus } from "react-icons/lu";
import { authAtom } from "../../../atoms/auth";
import Modal from "../../../components/ui/Modal";
import BottomSheet from "../../../components/ui/BottomSheet";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Select, { type SelectOption } from "../../../components/ui/Select";
import useShareDialog from "../../../hooks/useShareDialog";
import useIsMobile from "../../../hooks/useIsMobile";
import useDocumentMenuActions from "../../../hooks/useDocumentMenuActions";
import { formatAccessLevel } from "../../../utils/utils";
import PersonRow from "../../../components/people/PersonRow";
import ReadOnlyAccess from "./ReadOnlyAccess";
import EmailNotice from "../../../components/people/EmailNotice";
import ShareRowsSkeleton from "./ShareRowsSkeleton";
import GeneralAccessRow from "./GeneralAccessRow";
import AddPersonCard from "../../../components/people/AddPersonCard";

/** The four direct-access levels, in dropdown order. */
const LEVEL_OPTIONS: SelectOption<DocumentAccessLevel>[] = (
    ["admin", "editor", "viewer", "noAccess"] as const
).map((value) => ({ value, label: formatAccessLevel(value) }));

/**
 * Share dialog (pp 15–17 / 22–24): add people by email, the people with
 * access (the owner first, then everyone with direct access, each with a
 * level dropdown), the per-role General access with workspace-default
 * overrides, and Copy link. Every change applies immediately. Viewers and
 * editors see the same lists read-only, without the email field. On phones
 * it's a bottom sheet (pp 80 / 86) with shorter labels, no emails in the
 * rows, and no Copy link footer (the phone ⋯ sheet has Copy link).
 * @param documentId - the document being shared
 * @param title - its title, shown in the dialog's heading
 * @param onClose - closes the dialog
 */
const ShareDialog = ({
    documentId,
    title,
    onClose,
}: {
    documentId: string | undefined;
    title: string;
    onClose: () => void;
}) => {
    const {
        callerAccess,
        canManage,
        owner,
        roleOverrides,
        savingRole,
        updateRoleOverride,
        people,
        pendingUserId,
        changePersonAccess,
        removePerson,
        isInitialLoading,
        isFetchingMore,
        sentinelRef,
        email,
        setEmail,
        lookup,
        isAdding,
        addPerson,
    } = useShareDialog(documentId);
    const auth = useAtomValue(authAtom); // current user, for the "(you)" labels
    const { copyLink } = useDocumentMenuActions(); // Copy link, shared with the ⋯ menus
    const isMobile = useIsMobile(); // phones get a bottom sheet instead of a centered dialog

    const isOwner = callerAccess === "owner";
    // Only the owner may grant or change Admin.
    const grantableOptions = isOwner
        ? LEVEL_OPTIONS
        : LEVEL_OPTIONS.filter((o) => o.value !== "admin");

    /**
     * The access control for one person: a dropdown when the caller may
     * change them (not themselves; admins can't touch an Admin), otherwise
     * a read-only label. The dropdown notes the level they'd fall back to
     * and offers Remove access.
     * @param person - the person with direct access
     * @param isSelf - whether this is the caller
     */
    const renderPersonAccess = (
        person: DocumentAccessUserDto,
        isSelf: boolean,
    ) => {
        const canChange =
            canManage && !isSelf && (isOwner || person.access !== "admin");
        if (!canChange)
            return (
                <ReadOnlyAccess>
                    {formatAccessLevel(person.access)}
                </ReadOnlyAccess>
            );
        return (
            <Select
                variant="outline"
                value={person.access}
                options={grantableOptions}
                onChange={(access) => changePersonAccess(person.id, access)}
                disabled={pendingUserId === person.id}
                label={`Without direct access: ${formatAccessLevel(person.fallbackAccess)}`}
                action={{
                    label: "Remove access",
                    onSelect: () => removePerson(person.id),
                }}
                className="w-[6.5rem] sm:w-[7.5rem]"
            />
        );
    };

    const body = (
        <>
            {/* Add people — admins only */}
            {canManage && (
                <div className="mb-5">
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Add people by email"
                        icon={<LuUserPlus />}
                        aria-label="Add people by email"
                        className="sm:h-11"
                    />
                    {lookup.status === "found" ? (
                        <>
                            <div className="mt-2">
                                <AddPersonCard
                                    key={lookup.user.id}
                                    user={lookup.user}
                                    options={grantableOptions}
                                    defaultValue="editor"
                                    isAdding={isAdding}
                                    onAdd={addPerson}
                                />
                            </div>
                            <p className="mt-2 text-xs text-fg-muted">
                                Choose their access, then Add. It applies
                                immediately.
                            </p>
                        </>
                    ) : lookup.status === "notFound" ? (
                        <EmailNotice title="No Converge account with this email">
                            Check the spelling. They need to sign in to Converge
                            once before you can add them.
                        </EmailNotice>
                    ) : lookup.status === "hasAccess" ? (
                        <EmailNotice title="Already has access">
                            They're the workspace owner or already have direct
                            access below.
                        </EmailNotice>
                    ) : (
                        <p className="mt-2 text-xs text-fg-muted">
                            Type their full email. Access is given as soon as
                            you add them.
                        </p>
                    )}
                </div>
            )}

            {/* People with access */}
            <h3 className="mb-1.5 text-sm font-semibold text-fg">
                People with access
            </h3>
            {isInitialLoading ? (
                <ShareRowsSkeleton count={3} />
            ) : (
                // Desktop: capped at about 5½ rows (48px each) and scrolls on its
                // own, so General access and Copy link stay in view; the half
                // row hints there's more. Phones: uncapped, the dialog scrolls.
                <div
                    className="flex flex-col sm:max-h-[16.5rem] sm:overflow-y-auto"
                    style={{ scrollbarWidth: "thin" }}
                >
                    {owner && (
                        <PersonRow
                            name={owner.name}
                            isSelf={owner.email === auth.user?.email}
                            avatarUrl={
                                owner.email === auth.user?.email
                                    ? auth.user.avatarUrl
                                    : null
                            }
                            colorKey={owner.email}
                            subtitle="Workspace owner"
                        >
                            <ReadOnlyAccess icon={<LuLock />}>
                                Owner
                            </ReadOnlyAccess>
                        </PersonRow>
                    )}
                    {people.map((person) => {
                        const isSelf = Number(auth.user?.id) === person.id;
                        return (
                            <PersonRow
                                key={person.id}
                                name={person.name}
                                isSelf={isSelf}
                                avatarUrl={person.avatarUrl}
                                colorKey={person.email}
                                subtitle={
                                    <>
                                        <span className="hidden sm:inline">
                                            {person.email} ·{" "}
                                        </span>
                                        direct access
                                    </>
                                }
                            >
                                {renderPersonAccess(person, isSelf)}
                            </PersonRow>
                        );
                    })}
                    {/* Observed to load the next page of people */}
                    <div ref={sentinelRef} className="h-px" />
                    {isFetchingMore && <ShareRowsSkeleton count={2} />}
                </div>
            )}

            {/* General access — per-role overrides of the workspace defaults */}
            <div className="mt-4 border-t border-line pt-5">
                <h3 className="mb-1 text-sm font-semibold text-fg sm:mb-0">
                    General access
                </h3>
                <p className="mb-2 hidden text-sm text-fg-muted sm:block">
                    Applies to everyone in a role who has no direct access
                    above.
                </p>
                {isInitialLoading ? (
                    <ShareRowsSkeleton count={3} />
                ) : (
                    roleOverrides && (
                        <div className="flex flex-col">
                            <GeneralAccessRow
                                label="Workspace admins"
                                shortLabel="Admins"
                                override={roleOverrides.adminDocAccess}
                                workspaceDefault={
                                    roleOverrides.workspaceAdminDocAccess
                                }
                                canManage={canManage}
                                isSaving={savingRole === "adminDocAccess"}
                                onChange={(v) =>
                                    updateRoleOverride("adminDocAccess", v)
                                }
                            />
                            <GeneralAccessRow
                                label="Workspace members"
                                shortLabel="Members"
                                override={roleOverrides.memberDocAccess}
                                workspaceDefault={
                                    roleOverrides.workspaceMemberDocAccess
                                }
                                canManage={canManage}
                                isSaving={savingRole === "memberDocAccess"}
                                onChange={(v) =>
                                    updateRoleOverride("memberDocAccess", v)
                                }
                            />
                            <GeneralAccessRow
                                label="Non-members"
                                shortLabel="Non-members"
                                override={roleOverrides.nonMemberDocAccess}
                                workspaceDefault={
                                    roleOverrides.workspaceNonMemberDocAccess
                                }
                                canManage={canManage}
                                isSaving={savingRole === "nonMemberDocAccess"}
                                onChange={(v) =>
                                    updateRoleOverride("nonMemberDocAccess", v)
                                }
                            />
                        </div>
                    )
                )}
            </div>

            {/* Footer — desktop only; the phone ⋯ sheet has Copy link */}
            <div className="mt-4 hidden items-center justify-between gap-3 border-t border-line pt-5 sm:flex">
                <Button
                    onClick={() => copyLink({ id: Number(documentId), title })}
                    disabled={!documentId}
                >
                    <LuLink />
                    Copy link
                </Button>
                <span className="text-right text-xs text-fg-muted sm:text-sm">
                    Only people with access can open the link.
                </span>
            </div>
        </>
    );

    return isMobile ? (
        <BottomSheet onClose={onClose} title="Share" className="h-[92dvh]">
            {body}
        </BottomSheet>
    ) : (
        <Modal
            onClose={onClose}
            title={`Share “${title || "Untitled"}”`}
            description={canManage ? "Changes apply immediately." : undefined}
            size="md"
        >
            {body}
        </Modal>
    );
};

export default ShareDialog;
