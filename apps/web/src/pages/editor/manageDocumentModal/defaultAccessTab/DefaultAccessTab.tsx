import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import { type DocumentAccessLevel } from "@converge/shared";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import useDefaultAccessTab from "../../../../hooks/useDefaultAccessTab";

/** Options for the default access level dropdown. */
const ACCESS_OPTIONS: { label: string; value: DocumentAccessLevel }[] = [
    { label: "Admin", value: "admin" },
    { label: "Editor", value: "editor" },
    { label: "Viewer", value: "viewer" },
    { label: "No Access", value: "noAccess" },
];

/**
 * Default Access tab content for ManageDocumentModal. Displays and manages
 * the fallback access level applied to users with no explicit access entry.
 */
const DefaultAccessTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const { defaultAccess, isLoading, isSaving, updateDefaultAccess } =
        useDefaultAccessTab({ documentId });

    return (
        <>
            <div className="text-base sm:text-xl mb-3 sm:mb-6">
                Default Access
            </div>

            {isLoading ? (
                <AiOutlineLoading3Quarters className="animate-spin" />
            ) : (
                <Dropdown
                    value={defaultAccess}
                    options={ACCESS_OPTIONS}
                    onChange={(e) =>
                        updateDefaultAccess(e.value as DocumentAccessLevel)
                    }
                    placeholder="Select access"
                    disabled={isSaving || !documentId}
                    className="shrink-0 text-xs sm:text-sm"
                    pt={{
                        root: {
                            className:
                                "border-none bg-transparent focus:outline-none",
                        },
                        input: {
                            className:
                                "text-xs sm:text-sm text-white py-0.5 sm:py-1 px-1.5 sm:px-2",
                        },
                        trigger: { className: "text-white" },
                        panel: {
                            className:
                                "bg-background-base border border-gray-700",
                        },
                        item: {
                            className:
                                "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
                        },
                    }}
                />
            )}
            <p className="text-xs sm:text-sm text-text-secondary opacity-50 mb-3 sm:mb-4">
                The access level granted to users who have no explicit access
                entry for this document.
            </p>
        </>
    );
};

export default DefaultAccessTab;
