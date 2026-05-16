import { useState } from "react";

/** Sidebar navigation entries for ManageDocumentModal. */
const TABS: { key: "overview" | "access-overrides"; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "access-overrides", label: "Access Overrides" },
];

/** Manages ManageDocumentModal state: the active sidebar tab. */
const useManageDocumentModal = () => {
    const [selectedTab, setSelectedTab] = useState<
        "overview" | "access-overrides"
    >("overview"); // currently active sidebar tab

    return {
        selectedTab,
        setSelectedTab,
        TABS,
    };
};

export default useManageDocumentModal;
