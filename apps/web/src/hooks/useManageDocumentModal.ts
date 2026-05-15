import { useState } from "react";

/** Sidebar navigation entries; extend this array to add new tabs. */
const TABS: {
    key: "overview" | "manage-access" | "default-access" | "owner";
    label: string;
}[] = [
    { key: "overview", label: "Overview" },
    // { key: "manage-access", label: "Manage Access" },
    // { key: "default-access", label: "Default Access" },
    // { key: "owner", label: "Owner" },
];

/** Manages ManageDocumentModal state: the active sidebar tab. */
const useManageDocumentModal = () => {
    const [selectedTab, setSelectedTab] = useState<
        "overview" | "manage-access" | "default-access" | "owner"
    >("overview"); // currently active sidebar tab

    return {
        selectedTab,
        setSelectedTab,
        TABS,
    };
};

export default useManageDocumentModal;
