import { useState } from "react";

/** A ManageDocumentModal tab. */
export type ManageDocumentTab = "overview" | "access-overrides";

/** Sidebar navigation entries for ManageDocumentModal. */
const TABS: { key: ManageDocumentTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "access-overrides", label: "Access Overrides" },
];

/**
 * Manages ManageDocumentModal state: the active sidebar tab.
 * @param initialTab - the tab shown when the modal opens (default "overview")
 */
const useManageDocumentModal = (initialTab: ManageDocumentTab = "overview") => {
    const [selectedTab, setSelectedTab] =
        useState<ManageDocumentTab>(initialTab); // currently active sidebar tab

    return {
        selectedTab,
        setSelectedTab,
        TABS,
    };
};

export default useManageDocumentModal;
