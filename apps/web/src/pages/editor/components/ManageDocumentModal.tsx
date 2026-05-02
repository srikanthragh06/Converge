import { useEffect, useRef, useState } from "react";
import type { GetDocumentOverviewResponseDto } from "@converge/shared";
import apiClient from "../../../lib/http";
import { formatDate } from "../../../utils/utils";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

/** Sidebar navigation entries; extend this array to add new tabs. */
const TABS: { key: "overview"; label: string }[] = [
    { key: "overview", label: "Overview" },
];

/**
 * Modal for document-level settings and actions. On mobile it renders as a
 * bottom sheet with a swipe-down-to-dismiss gesture; on sm+ it renders as a
 * centred dialog. Closes on Escape, backdrop click, or swipe down.
 */
const ManageDocumentModal = ({
    onClose,
    documentId,
}: {
    /** Called when the user dismisses the modal. */
    onClose: () => void;
    /** ID of the document being managed, passed to DeleteConfirmationModal. */
    documentId: string | undefined;
}) => {
    const [dragOffset, setDragOffset] = useState(0); // current vertical drag distance in px; drives the translateY transform
    const touchStartY = useRef(0); // Y position when the touch began
    const isDragging = useRef(false); // true while a touch is in progress
    const [selectedTab, setSelectedTab] = useState<"overview">("overview"); // currently active sidebar tab
    const [isDeleteDocumentConfirmOpen, setIsDeleteDocumentConfirmOpen] =
        useState(false); // controls DeleteConfirmationModal visibility
    const [overview, setOverview] =
        useState<GetDocumentOverviewResponseDto | null>(null); // fetched overview data; null while loading or on error

    // Fetch overview data on mount.
    useEffect(() => {
        if (!documentId) return;
        apiClient
            .get<GetDocumentOverviewResponseDto>(
                `/document/${documentId}/overview`,
            )
            .then((res) => setOverview(res.data))
            .catch((err) =>
                console.error(
                    "ManageDocumentModal: failed to fetch overview:",
                    err,
                ),
            );
    }, [documentId]);

    // Close on Escape key, but only when the confirmation modal is not open
    // (DeleteConfirmationModal has its own Escape handler and takes priority).
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isDeleteDocumentConfirmOpen) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, isDeleteDocumentConfirmOpen]);

    /** Records the starting Y position of the touch. */
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
    };

    /** Translates the panel downward as the user drags; ignores upward drags. */
    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta > 0) setDragOffset(delta);
    };

    /** Dismisses the modal if dragged past 80 px; otherwise snaps back. */
    const handleTouchEnd = () => {
        isDragging.current = false;
        if (dragOffset > 80) {
            onClose();
        } else {
            setDragOffset(0);
        }
    };

    return (
        <>
            {/* Backdrop — click outside the panel to close */}
            <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
                onClick={onClose}
            >
                {/* Panel — stop backdrop-click from propagating */}
                <div
                    className="bg-background-base w-full sm:max-w-4xl sm:mx-4
                    rounded-t-2xl sm:rounded-xl
                    h-[94dvh] sm:h-auto sm:max-h-[80vh]
                    flex flex-col overflow-hidden"
                    style={{
                        transform: `translateY(${dragOffset}px)`,
                        transition: isDragging.current
                            ? "none"
                            : "transform 0.2s ease",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Drag handle — touch target for swipe-down-to-dismiss on mobile */}
                    <div
                        className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden cursor-grab active:cursor-grabbing"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="w-10 h-1 rounded-full bg-background-hover" />
                    </div>

                    {/* Content area */}
                    <div className="flex flex-col sm:flex-row min-h-[500px] h-full">
                        <div className="flex flex-row sm:flex-col shrink-0 p-2 gap-1">
                            {TABS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTab(key)}
                                    className={`text-text-secondary text-sm sm:pl-3 sm:pr-6 px-2 py-2 cursor-pointer
                                    border-none text-start rounded-lg transition
                                    ${selectedTab === key ? "bg-background-elevated" : "bg-transparent hover:opacity-80 active:opacity-75"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="h-[1px] w-full sm:h-auto sm:w-[1px] bg-background-elevated shrink-0" />
                        <div className="flex-1 bg-background-base flex flex-col px-6 py-5">
                            {selectedTab === "overview" && (
                                <>
                                    <div className="text-xl mb-6">Overview</div>
                                    <div className="flex flex-col space-y-4">
                                        <div className="text-sm">
                                            <span className="opacity-50">
                                                Title:{" "}
                                            </span>
                                            <span
                                                className={`text-text-secondary ${!overview?.title && "opacity-50"}`}
                                            >
                                                {overview?.title || "Untitled"}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <span className="opacity-50">
                                                Last visited:{" "}
                                            </span>
                                            <span className="text-text-secondary">
                                                {overview
                                                    ? formatDate(
                                                          overview.lastVisitedAt,
                                                      )
                                                    : "—"}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <span className="opacity-50">
                                                Last edited:{" "}
                                            </span>
                                            <span className="text-text-secondary">
                                                {overview
                                                    ? formatDate(
                                                          overview.lastEditedAt,
                                                      )
                                                    : "—"}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <span className="opacity-50">
                                                Creator:{" "}
                                            </span>
                                            <span className="text-text-secondary">
                                                {overview
                                                    ? `${overview.creatorName} (${overview.creatorEmail})`
                                                    : "—"}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <span className="opacity-50">
                                                Created on:{" "}
                                            </span>
                                            <span className="text-text-secondary">
                                                {overview
                                                    ? formatDate(
                                                          overview.createdAt,
                                                      )
                                                    : "—"}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() =>
                                            setIsDeleteDocumentConfirmOpen(true)
                                        }
                                        className="border-none bg-red-700 text-white w-[150px] text-sm mt-10
                                                text-center rounded-lg px-3 py-1 cursor-pointer hover:opacity-80 active:opacity-70 transition"
                                    >
                                        Delete Document
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isDeleteDocumentConfirmOpen && (
                <DeleteConfirmationModal
                    documentId={documentId}
                    onCancel={() => setIsDeleteDocumentConfirmOpen(false)}
                />
            )}
        </>
    );
};

export default ManageDocumentModal;
