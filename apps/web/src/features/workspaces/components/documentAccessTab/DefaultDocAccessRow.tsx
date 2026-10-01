import type {
    DocumentAccessLevel,
    GetWorkspaceDocAccessDefaultsResponseDto,
} from "@converge/shared";
import Select, { type SelectOption } from "@/components/ui/Select";

/** Dropdown options for a document access level field. */
const ACCESS_OPTIONS: SelectOption<DocumentAccessLevel>[] = [
    { label: "Admin", value: "admin" },
    { label: "Editor", value: "editor" },
    { label: "Viewer", value: "viewer" },
    { label: "No access", value: "noAccess" },
];

/**
 * One row of the Default access tab (pp 20 / 27): a workspace role with a
 * one-line description on the left, and its default document access
 * dropdown on the right (read-only when the caller can't change it).
 * @param label - the role, e.g. "Members"
 * @param description - who the role covers, e.g. "Everyone else in the workspace"
 * @param field - the defaults object key this row controls
 * @param value - current access level
 * @param disabled - read-only for the current caller
 * @param isSaving - a save is in flight (disables every dropdown during the PATCH)
 * @param onUpdate - called when the user selects a new value
 */
const DefaultDocAccessRow = ({
    label,
    description,
    field,
    value,
    disabled,
    isSaving,
    onUpdate,
}: {
    label: string;
    description: string;
    field: keyof GetWorkspaceDocAccessDefaultsResponseDto;
    value: DocumentAccessLevel;
    disabled: boolean;
    isSaving: boolean;
    onUpdate: (
        field: keyof GetWorkspaceDocAccessDefaultsResponseDto,
        value: DocumentAccessLevel,
    ) => void;
}) => (
    <div className="flex items-center justify-between gap-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] text-fg">{label}</span>
            <span className="text-xs text-fg-muted">{description}</span>
        </div>
        <Select
            variant="outline"
            value={value}
            options={ACCESS_OPTIONS}
            onChange={(v) => onUpdate(field, v)}
            disabled={disabled || isSaving}
            hideChevron={disabled}
            className="w-[7.5rem] sm:w-[8.75rem]"
        />
    </div>
);

export default DefaultDocAccessRow;
