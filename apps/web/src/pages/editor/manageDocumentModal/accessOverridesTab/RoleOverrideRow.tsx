import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import type { DocumentAccessLevel } from "@converge/shared";

/** Display labels for each document access level. */
const ACCESS_LABELS: Record<DocumentAccessLevel, string> = {
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
    noAccess: "No Access",
};

/** Option shape for the role override dropdown, including the sentinel "__default__" value. */
interface RoleOverrideOption {
    label: string;
    value: DocumentAccessLevel | "__default__";
}

/** Shared PrimeReact passthrough styling for the override dropdown. */
const dropdownPt = (disabled: boolean) => ({
    root: { className: "border-none bg-transparent focus:outline-none" },
    input: {
        className:
            "text-xs sm:text-sm text-white py-0.5 sm:py-1 px-1.5 sm:px-2",
    },
    trigger: { className: disabled ? "hidden" : "text-white" },
    panel: { className: "bg-background-base border border-gray-700" },
    item: {
        className:
            "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
    },
});

/**
 * A single row in the role overrides section. Shows a workspace-role label on
 * the left and a dropdown on the right. The dropdown includes all four access
 * levels plus a "Default (…)" option that maps to null and resets the override
 * to the workspace-level default for that role.
 */
const RoleOverrideRow = ({
    label,
    value,
    workspaceDefault,
    disabled,
    isSaving,
    onUpdate,
}: {
    /** Display label for the workspace role (e.g. "Admin", "Member"). */
    label: string;
    /** Current per-document override, or null when no override is set. */
    value: DocumentAccessLevel | null;
    /** Workspace-level default for this role, shown inside the "Default (…)" label. */
    workspaceDefault: DocumentAccessLevel;
    /** Whether editing is disabled for the current caller. */
    disabled: boolean;
    /** Whether a save is in-flight — disables the dropdown during the request. */
    isSaving: boolean;
    /** Called with the chosen access level, or null to reset to workspace default. */
    onUpdate: (value: DocumentAccessLevel | null) => void;
}) => {
    const options: RoleOverrideOption[] = [
        {
            label: `Default (${ACCESS_LABELS[workspaceDefault]})`,
            value: "__default__",
        },
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" },
        { label: "No Access", value: "noAccess" },
    ];

    /** Maps the sentinel "__default__" back to null when the user picks the default option. */
    const handleChange = (selected: DocumentAccessLevel | "__default__") => {
        onUpdate(selected === "__default__" ? null : selected);
    };

    return (
        <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-text-secondary">{label}</span>
            <Dropdown
                value={value ?? "__default__"}
                options={options}
                onChange={(e) => handleChange(e.value)}
                disabled={disabled || isSaving}
                className="shrink-0 text-xs sm:text-sm"
                pt={dropdownPt(disabled)}
            />
        </div>
    );
};

export default RoleOverrideRow;
