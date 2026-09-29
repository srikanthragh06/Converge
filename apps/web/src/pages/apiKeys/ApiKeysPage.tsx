import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LuChevronDown, LuPlus } from "react-icons/lu";
import type { ApiKeyDto } from "@converge/shared";
import { cn } from "../../lib/utils";
import Page from "../../components/Page";
import TableSkeleton from "../../components/ui/TableSkeleton";
import { PageContainer, PageHeader } from "../../components/ui/PageHeader";
import { Table, TableHeadCell, TableHeader } from "../../components/ui/Table";
import useApiKeys from "../../hooks/useApiKeys";
import useCreateApiKey from "../../hooks/useCreateApiKey";
import ApiKeyRow from "./components/ApiKeyRow";
import McpSetupBanner from "./components/McpSetupBanner";
import CreateApiKeyModal from "./components/CreateApiKeyModal";
import RevealApiKeyModal from "./components/RevealApiKeyModal";
import RevokeApiKeyConfirmationModal from "./components/RevokeApiKeyConfirmationModal";

/** Column template shared by the Active and Revoked tables. */
const COLUMNS = "minmax(0,1fr) 9rem 7.5rem 7.5rem 6rem";

/** Column template on phones, where only the name and the action remain. */
const MOBILE_COLUMNS = "minmax(0,1fr) auto";

/**
 * API keys page (pp 33–36 / 41–44): the user's keys for MCP and other
 * non-browser callers, split into Active (with Revoke) and a collapsible
 * Revoked section, under a banner pointing to MCP setup. New key opens the
 * create dialog, then a one-time dialog showing the full key.
 */
const ApiKeysPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { apiKeys, isLoading, fetchAll } = useApiKeys(); // fetched key list, loading flag, and manual refetch
    const { createApiKey, isCreating, error } = useCreateApiKey(); // key creation handler, in-flight flag, and last error message
    const [showCreateModal, setShowCreateModal] = useState(false); // controls Create Key modal visibility
    const [handledCreateKey, setHandledCreateKey] = useState<string | null>(
        null,
    ); // location key whose createKey request was already acted on
    const [revealed, setRevealed] = useState<{
        label: string;
        rawKey: string;
    } | null>(null); // newly created key, shown once; null when no reveal is pending
    const [revokingKey, setRevokingKey] = useState<ApiKeyDto | null>(null); // key pending revoke confirmation
    const [isRevokedOpen, setIsRevokedOpen] = useState(true); // whether the Revoked section is expanded

    // MCP setup's "Create an API key" navigates here with createKey in the
    // router state. Opened during render, React's pattern for adjusting
    // state when a prop changes, once per navigation.
    const wantsCreateKey =
        (location.state as { createKey?: boolean } | null)?.createKey === true;
    if (wantsCreateKey && location.key !== handledCreateKey) {
        setHandledCreateKey(location.key);
        setShowCreateModal(true);
    }

    // Drops the request from the history entry once acted on, so a reload or
    // Back doesn't reopen the dialog.
    useEffect(() => {
        if (wantsCreateKey)
            navigate(location.pathname, { replace: true, state: null });
    }, [wantsCreateKey, navigate, location.pathname]);

    const activeKeys = apiKeys.filter((k) => k.revokedAt === null);
    const revokedKeys = apiKeys.filter((k) => k.revokedAt !== null);

    /**
     * Creates a key via useCreateApiKey. On success, closes the create
     * modal and opens the one-time reveal modal with the raw key.
     * @param label - the new key's name
     */
    const handleCreate = async (label: string) => {
        const created = await createApiKey(label);
        if (created) {
            setShowCreateModal(false);
            setRevealed({ label: created.label, rawKey: created.rawKey });
        }
    };

    /** Dismisses the reveal modal and refetches the list to show the new key. */
    const handleRevealDone = () => {
        setRevealed(null);
        fetchAll();
    };

    return (
        <Page authRequired haveSidebar mobileTitle="API keys">
            <div className="flex-1 overflow-y-auto">
                <PageContainer>
                    <PageHeader
                        title="API keys"
                        description="Keys let AI agents act as you through MCP, with your exact permissions. Treat them like passwords."
                        action={{
                            label: "New key",
                            icon: <LuPlus />,
                            onClick: () => setShowCreateModal(true),
                        }}
                    />
                    <McpSetupBanner />

                    {isLoading && apiKeys.length === 0 ? (
                        <TableSkeleton rows={3} />
                    ) : (
                        <>
                            <h2 className="px-3 pb-1 text-[15px] font-semibold text-fg">
                                Active keys ({activeKeys.length})
                            </h2>
                            <Table
                                columns={COLUMNS}
                                mobileColumns={MOBILE_COLUMNS}
                            >
                                <TableHeader>
                                    <TableHeadCell>Name</TableHeadCell>
                                    <TableHeadCell hideOnMobile>
                                        Key
                                    </TableHeadCell>
                                    <TableHeadCell hideOnMobile>
                                        Created
                                    </TableHeadCell>
                                    <TableHeadCell hideOnMobile>
                                        Last used
                                    </TableHeadCell>
                                    <TableHeadCell />
                                </TableHeader>
                                {activeKeys.map((key) => (
                                    <ApiKeyRow
                                        key={key.id}
                                        apiKey={key}
                                        onRevoke={() => setRevokingKey(key)}
                                    />
                                ))}
                                {activeKeys.length === 0 && (
                                    <p className="py-8 text-center text-sm text-fg-muted">
                                        No active keys. Create one to connect an
                                        agent.
                                    </p>
                                )}
                            </Table>

                            {revokedKeys.length > 0 && (
                                <section className="mt-8">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsRevokedOpen((open) => !open)
                                        }
                                        aria-expanded={isRevokedOpen}
                                        className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 pb-2 text-[15px] font-semibold text-fg-secondary outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-gold/60"
                                    >
                                        <LuChevronDown
                                            className={cn(
                                                "h-4 w-4 transition-transform",
                                                !isRevokedOpen && "-rotate-90",
                                            )}
                                        />
                                        Revoked · {revokedKeys.length}
                                    </button>
                                    {isRevokedOpen && (
                                        <Table
                                            columns={COLUMNS}
                                            mobileColumns={MOBILE_COLUMNS}
                                            className="before:mx-3 before:h-px before:bg-line-subtle"
                                        >
                                            {revokedKeys.map((key) => (
                                                <ApiKeyRow
                                                    key={key.id}
                                                    apiKey={key}
                                                />
                                            ))}
                                        </Table>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                </PageContainer>
            </div>

            {showCreateModal && (
                <CreateApiKeyModal
                    onCreate={handleCreate}
                    onCancel={() => setShowCreateModal(false)}
                    isCreating={isCreating}
                    error={error}
                />
            )}

            {revealed && (
                <RevealApiKeyModal
                    label={revealed.label}
                    rawKey={revealed.rawKey}
                    onDone={handleRevealDone}
                    onOpenMcpSetup={() => {
                        setRevealed(null);
                        navigate("/mcp-docs");
                    }}
                />
            )}

            {revokingKey && (
                <RevokeApiKeyConfirmationModal
                    apiKey={revokingKey}
                    onCancel={() => setRevokingKey(null)}
                    onSuccess={() => {
                        setRevokingKey(null);
                        fetchAll();
                    }}
                />
            )}
        </Page>
    );
};

export default ApiKeysPage;
