import React, { useRef, useState } from "react";

/** Sidebar navigation entries; extend this array to add new tabs. */
const TABS: { key: "overview"; label: string }[] = [
    { key: "overview", label: "Overview" },
];

/**
 * Manages ManageDocumentModal state: swipe-to-dismiss gesture tracking and
 * the active sidebar tab.
 */
const useManageDocumentModal = ({
    onClose,
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

    return {
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        selectedTab,
        setSelectedTab,
        isDragging,
        dragOffset,
        TABS,
    };
};

export default useManageDocumentModal;
