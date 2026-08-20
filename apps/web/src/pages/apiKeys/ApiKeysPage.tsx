import { useState } from "react";
import Page from "../../components/Page";
import { Skeleton } from "primereact/skeleton";
import DelayedRender from "../../components/DelayedRender";
import useApiKeys from "../../hooks/useApiKeys";
import useCreateApiKey from "../../hooks/useCreateApiKey";
import ApiKeyCard from "./components/ApiKeyCard";
import CreateApiKeyModal from "./components/CreateApiKeyModal";
import RevealApiKeyModal from "./components/RevealApiKeyModal";
import RevokeApiKeyConfirmationModal from "./components/RevokeApiKeyConfirmationModal";

/**
 * Full-screen API keys page. Lists the authenticated user's API keys and
 * lets them create new ones or revoke existing ones.
 */
const ApiKeysPage = () => {
    const { apiKeys, isLoading, fetchAll } = useApiKeys(); // fetched key list, loading flag, and manual refetch
    const { createApiKey, isCreating, error } = useCreateApiKey(); // key creation handler, in-flight flag, and last error message
    const [showCreateModal, setShowCreateModal] = useState(false); // controls Create Key modal visibility
    const [revealRawKey, setRevealRawKey] = useState<string | null>(null); // newly created key's raw value, shown once; null when no reveal is pending
    const [revokingKey, setRevokingKey] = useState<{
        id: number;
        label: string;
    } | null>(null); // key pending revoke confirmation; null when no revoke dialog is open

    /**
     * Creates a key via useCreateApiKey. On success, closes the create
     * modal and opens the one-time reveal modal with the raw key.
     */
    const handleCreate = async (label: string) => {
        const created = await createApiKey(label);
        if (created) {
            setShowCreateModal(false);
            setRevealRawKey(created.rawKey);
        }
    };

    /** Dismisses the reveal modal and refetches the list to show the new key. */
    const handleRevealDone = () => {
        setRevealRawKey(null);
        fetchAll();
    };

    return (
        <Page authRequired haveSidebar>
            {/* Header — title above, create-key button below, does not scroll */}
            <div className="bg-background-base pb-4 pt-4 sm:pt-8 w-full flex flex-col space-y-4">
                <div className="flex flex-col items-center w-full px-4 sm:px-0">
                    <div className="w-full sm:max-w-[600px]">
                        <div className="text-text-primary font-bold flex justify-start sm:mb-4 mb-2">
                            <h1 className="sm:text-3xl text-xl">API Keys</h1>
                        </div>
                        <div className="w-full flex flex-row items-center justify-center">
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="w-1/2 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                                 hover:opacity-90 active:opacity-80 transition
                                cursor-pointer"
                            >
                                New Key
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key list — loading skeletons, empty state, or the fetched cards */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 pb-6">
                {isLoading && apiKeys.length === 0 && (
                    <DelayedRender>
                        <div className="w-full sm:max-w-[600px] flex flex-col gap-2 px-4 sm:px-0 mt-2">
                            <Skeleton height="4.5rem" width="100%" />
                            <Skeleton height="4.5rem" width="100%" />
                        </div>
                    </DelayedRender>
                )}

                {!isLoading && apiKeys.length === 0 && (
                    <span className="text-sm opacity-40 mt-8">
                        No API keys yet
                    </span>
                )}

                {apiKeys.map((key) => (
                    <ApiKeyCard
                        key={key.id}
                        apiKey={key}
                        onRevoke={(id) =>
                            setRevokingKey({ id, label: key.label })
                        }
                    />
                ))}
            </div>

            {showCreateModal && (
                <CreateApiKeyModal
                    onCreate={handleCreate}
                    onCancel={() => setShowCreateModal(false)}
                    isCreating={isCreating}
                    error={error}
                />
            )}

            {revealRawKey && (
                <RevealApiKeyModal
                    rawKey={revealRawKey}
                    onDone={handleRevealDone}
                />
            )}

            {revokingKey && (
                <RevokeApiKeyConfirmationModal
                    keyId={revokingKey.id}
                    label={revokingKey.label}
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
