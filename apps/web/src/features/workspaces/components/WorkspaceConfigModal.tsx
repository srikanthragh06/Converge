import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LuX } from "react-icons/lu";
import { cn } from "@/lib/utils";
import useMyWorkspaceRole from "@/features/workspaces/hooks/useMyWorkspaceRole";
import useWorkspaceOverview from "@/features/workspaces/hooks/useWorkspaceOverview";
import WorkspaceTile from "./WorkspaceTile";
import DocumentAccessTab from "./documentAccessTab/DocumentAccessTab";
import GeneralTab from "./generalTab/GeneralTab";
import MembersTab from "./membersTab/MembersTab";
import OwnerTab from "./ownerTab/OwnerTab";

/** Key of a settings tab. */
type TabKey = "general" | "members" | "document-access" | "owner";

/** The settings tabs, in nav order, with each one's heading and subtitle. */
const TABS: { key: TabKey; label: string; description: string }[] = [
    {
        key: "general",
        label: "General",
        description: "Name and details for this workspace.",
    },
    {
        key: "members",
        label: "Members",
        description:
            "Add people by typing their full email. They get access right away, based on their role.",
    },
    {
        key: "document-access",
        label: "Default access",
        description:
            "What each role can do on every document, unless a document overrides it or shares directly.",
    },
    {
        key: "owner",
        label: "Ownership",
        description:
            "The owner always has full access to every document and can't be removed.",
    },
];

/**
 * Workspace settings (pp 18–21 / 25–28): a two-pane dialog with the
 * workspace and tab list on the left and the active tab on the right — on
 * phones it fills the screen with the tabs in a scrolling row on top. Built on Radix Dialog, so focus is trapped and Escape or a backdrop click
 * closes it.
 * @param workspaceId - the workspace to configure
 * @param onClose - called when the dialog closes, or after the user leaves the workspace
 * @param initialTab - key of the tab shown first (default "general"), e.g.
 *                     "members" for the sidebar's "Members & access"
 */
const WorkspaceConfigModal = ({
    workspaceId,
    onClose,
    initialTab = "general",
}: {
    workspaceId: number;
    onClose: () => void;
    initialTab?: string;
}) => {
    const [selectedTab, setSelectedTab] = useState<TabKey>(
        TABS.some((t) => t.key === initialTab)
            ? (initialTab as TabKey)
            : "general",
    ); // currently shown tab
    const { overview } = useWorkspaceOverview(workspaceId);
    const { role } = useMyWorkspaceRole(workspaceId);
    const isOwner = role === "owner";
    const tab = TABS.find((t) => t.key === selectedTab)!;
    // Plain members can't add anyone, so their Members subtitle just describes the list.
    const description =
        selectedTab === "members" && role === "member"
            ? "Everyone in this workspace and their role."
            : tab.description;

    return (
        <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay" />
                <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center sm:p-4">
                    <DialogPrimitive.Content className="pointer-events-auto relative flex h-full w-full animate-modal-in flex-col overflow-hidden bg-surface-elevated text-fg shadow-2xl shadow-shadow outline-none sm:h-[min(44rem,100%)] sm:max-w-[54rem] sm:flex-row sm:rounded-xl sm:border sm:border-line">
                        {/* Left pane — workspace and tabs; a top bar with a scrolling tab row on phones */}
                        <nav className="flex shrink-0 flex-col gap-3 border-b border-line bg-surface-sidebar p-3 sm:w-[13.25rem] sm:gap-4 sm:border-b-0 sm:border-r sm:pt-5">
                            <div className="flex min-w-0 items-center gap-2.5 px-1 pr-10 sm:pr-1">
                                <WorkspaceTile
                                    name={overview?.name ?? ""}
                                    type={overview?.type}
                                />
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-semibold text-fg">
                                        {overview?.name}
                                    </span>
                                    <span className="text-xs text-fg-muted">
                                        Workspace settings
                                    </span>
                                </div>
                            </div>
                            <div className="-mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0">
                                {TABS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedTab(key)}
                                        aria-current={
                                            key === selectedTab
                                                ? "page"
                                                : undefined
                                        }
                                        className={cn(
                                            "shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 sm:py-2 sm:text-[15px]",
                                            key === selectedTab
                                                ? "bg-surface-selected font-semibold text-fg"
                                                : "text-fg-secondary hover:bg-surface-hover hover:text-fg",
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </nav>

                        {/* Right pane — the active tab */}
                        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-5 sm:px-8 sm:pt-7">
                            <div className="mb-5 flex flex-col gap-1 sm:mb-6">
                                <DialogPrimitive.Title className="font-serif text-2xl font-medium leading-tight text-fg sm:pr-10 sm:text-[1.75rem]">
                                    {tab.label}
                                </DialogPrimitive.Title>
                                <DialogPrimitive.Description className="text-sm text-fg-muted sm:text-[13px]">
                                    {description}
                                </DialogPrimitive.Description>
                            </div>
                            {selectedTab === "general" && (
                                <GeneralTab
                                    workspaceId={workspaceId}
                                    onLeft={onClose}
                                    onGoToTab={setSelectedTab}
                                />
                            )}
                            {selectedTab === "members" && (
                                <MembersTab
                                    workspaceId={workspaceId}
                                    role={role}
                                    membersCount={
                                        overview?.membersCount ?? null
                                    }
                                />
                            )}
                            {selectedTab === "document-access" && (
                                <DocumentAccessTab workspaceId={workspaceId} />
                            )}
                            {selectedTab === "owner" && overview && (
                                <OwnerTab
                                    workspaceId={workspaceId}
                                    workspaceName={overview.name}
                                    isOwner={isOwner}
                                    isPersonal={overview.type === "personal"}
                                />
                            )}
                        </section>

                        <DialogPrimitive.Close
                            aria-label="Close"
                            className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-gold/60 sm:right-5 sm:top-6"
                        >
                            <LuX className="h-4 w-4" />
                        </DialogPrimitive.Close>
                    </DialogPrimitive.Content>
                </div>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default WorkspaceConfigModal;
