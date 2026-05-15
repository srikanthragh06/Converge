import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import type {
    DocumentAccessLevel,
    GetWorkspaceDocAccessDefaultsResponseDto,
} from "@converge/shared";

/** Dropdown options for a document access level field. */
const ACCESS_OPTIONS: { label: string; value: DocumentAccessLevel }[] = [
    { label: "Admin", value: "admin" },
    { label: "Editor", value: "editor" },
    { label: "Viewer", value: "viewer" },
    { label: "No Access", value: "noAccess" },
];

/** Shared PrimeReact passthrough styling for each access dropdown. */
const dropdownPt = (disabled: boolean) => ({
    root: {
        className: "border-none bg-transparent focus:outline-none",
    },
    input: {
        className:
            "text-xs sm:text-sm text-white py-0.5 sm:py-1 px-1.5 sm:px-2",
    },
    trigger: { className: disabled ? "hidden" : "text-white" },
    panel: {
        className: "bg-background-base border border-gray-700",
    },
    item: {
        className:
            "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
    },
});

/** A single row showing a workspace role label and its default document access level dropdown. */
const DefaultDocAccessRow = ({
    label,
    field,
    value,
    disabled,
    isSaving,
    onUpdate,
}: {
    /** Display label for the workspace role. */
    label: string;
    /** The defaults object key this row controls. */
    field: keyof GetWorkspaceDocAccessDefaultsResponseDto;
    /** Current access level value. */
    value: DocumentAccessLevel;
    /** Whether the dropdown is read-only for the current caller. */
    disabled: boolean;
    /** Whether a save is in flight (disables all dropdowns during patch). */
    isSaving: boolean;
    /** Called when the user selects a new value. */
    onUpdate: (
        field: keyof GetWorkspaceDocAccessDefaultsResponseDto,
        value: DocumentAccessLevel,
    ) => void;
}) => (
    <div
        className="flex items-center justify-between py-3
         border-background-elevated last:border-b-0"
    >
        <span className="text-sm text-text-secondary">{label}</span>
        <Dropdown
            value={value}
            options={ACCESS_OPTIONS}
            onChange={(e) => onUpdate(field, e.value as DocumentAccessLevel)}
            disabled={disabled || isSaving}
            className="shrink-0 text-xs sm:text-sm"
            pt={dropdownPt(disabled)}
        />
    </div>
);

export default DefaultDocAccessRow;
