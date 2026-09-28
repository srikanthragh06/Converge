import type {
    DocumentAccessLevel,
    GetWorkspaceDocAccessDefaultsResponseDto,
} from "@converge/shared";
import Select, { type SelectOption } from "../../../../components/ui/Select";

/** Dropdown options for a document access level field. */
const ACCESS_OPTIONS: SelectOption<DocumentAccessLevel>[] = [
    { label: "Admin", value: "admin" },
    { label: "Editor", value: "editor" },
    { label: "Viewer", value: "viewer" },
    { label: "No Access", value: "noAccess" },
];

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
        <Select
            value={value}
            options={ACCESS_OPTIONS}
            onChange={(v) => onUpdate(field, v)}
            disabled={disabled || isSaving}
            hideChevron={disabled}
        />
    </div>
);

export default DefaultDocAccessRow;
