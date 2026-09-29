import type { DocumentIndexingStatus } from "@converge/shared";
import Modal from "../../../components/ui/Modal";
import ModalFooter from "../../../components/ui/ModalFooter";
import Button from "../../../components/ui/Button";
import Skeleton from "../../../components/ui/Skeleton";
import { StatusDot, type StatusTone } from "../../../components/ui/Badge";
import DelayedRender from "../../../components/DelayedRender";
import useDocumentDetails from "../../../hooks/useDocumentDetails";
import DetailRow from "./DetailRow";
import { formatAccessLevel, formatDate, timeAgo } from "../../../utils/utils";

/** Dot tone and label for each search indexing state. */
const INDEXING_STATUS: Record<
    DocumentIndexingStatus,
    { tone: StatusTone; label: string }
> = {
    idle: { tone: "success", label: "Up to date" },
    pending: { tone: "pending", label: "Pending" },
    indexing: { tone: "pending", label: "Indexing…" },
};

/**
 * Document details modal (pp 49 / 55): title, workspace, the caller's
 * access, owner, creator, created date, and search indexing status with
 * when it last ran. Read-only; the indexing status updates live while open.
 * @param documentId - the document to describe
 * @param onClose - closes the modal
 */
const DocumentDetailsModal = ({
    documentId,
    onClose,
}: {
    documentId: string | undefined;
    onClose: () => void;
}) => {
    const { overview, document, isLoading } = useDocumentDetails(documentId);
    const indexing = overview && INDEXING_STATUS[overview.indexingStatus];

    return (
        <Modal
            onClose={onClose}
            title="Document details"
            description="Search indexing updates a few seconds after edits."
            className="max-w-[520px]"
        >
            {isLoading ? (
                <DelayedRender>
                    <div className="flex flex-col gap-4 py-3">
                        {Array.from({ length: 8 }, (_, i) => (
                            <Skeleton key={i} height="1.25rem" />
                        ))}
                    </div>
                </DelayedRender>
            ) : (
                <dl className="mt-2 flex flex-col">
                    <DetailRow label="Title">
                        {overview?.title || (
                            <span className="text-fg-muted">Untitled</span>
                        )}
                    </DetailRow>
                    <DetailRow label="Workspace">
                        {document?.workspace.name ?? "—"}
                    </DetailRow>
                    <DetailRow label="Your access">
                        {document
                            ? formatAccessLevel(document.resolvedAccess)
                            : "—"}
                    </DetailRow>
                    <DetailRow label="Owner">
                        {overview?.ownerName ?? "—"}
                    </DetailRow>
                    <DetailRow label="Created by">
                        {overview?.creatorName ?? "—"}
                    </DetailRow>
                    <DetailRow label="Created">
                        {overview ? formatDate(overview.createdAt) : "—"}
                    </DetailRow>
                    <DetailRow label="Search indexing">
                        {indexing ? (
                            <StatusDot
                                tone={indexing.tone}
                                label={indexing.label}
                                className="gap-2 text-sm text-fg"
                            />
                        ) : (
                            "—"
                        )}
                    </DetailRow>
                    <DetailRow label="Last indexed">
                        {overview
                            ? overview.lastIndexedAt
                                ? timeAgo(overview.lastIndexedAt)
                                : "Never"
                            : "—"}
                    </DetailRow>
                </dl>
            )}
            <ModalFooter>
                <Button onClick={onClose}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default DocumentDetailsModal;
