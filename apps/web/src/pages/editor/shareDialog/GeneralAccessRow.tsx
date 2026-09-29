import type { DocumentAccessLevel } from "@converge/shared";
import Select, { type SelectOption } from "../../../components/ui/Select";
import { formatAccessLevel } from "../../../utils/utils";
import { ReadOnlyAccess } from "./SharePersonRow";

/** The four levels a role can be given, in dropdown order. */
const LEVEL_OPTIONS: SelectOption<DocumentAccessLevel>[] = (
    ["admin", "editor", "viewer", "noAccess"] as const
).map((value) => ({ value, label: formatAccessLevel(value) }));

/**
 * One workspace role in the Share dialog's General access section. The
 * dropdown shows the role's effective level — the document's override, or
 * the workspace default when there is none. The subtitle reads "Workspace
 * default", or a gold "Overridden for this document · default is X" note
 * with a "Reset to workspace default" action in the dropdown.
 * @param label - the role, e.g. "Workspace members"
 * @param shortLabel - the role on phones, e.g. "Members" (pp 80 / 86)
 * @param override - the document's override for the role, or null
 * @param workspaceDefault - the workspace's level for the role
 * @param canManage - whether the caller may change it; otherwise a read-only label
 * @param isSaving - disables the dropdown while its update is in flight
 * @param onChange - called with a level, or null to reset to the default
 */
const GeneralAccessRow = ({
    label,
    shortLabel,
    override,
    workspaceDefault,
    canManage,
    isSaving,
    onChange,
}: {
    label: string;
    shortLabel: string;
    override: DocumentAccessLevel | null;
    workspaceDefault: DocumentAccessLevel;
    canManage: boolean;
    isSaving: boolean;
    onChange: (value: DocumentAccessLevel | null) => void;
}) => {
    const effective = override ?? workspaceDefault; // the level this role actually gets
    const defaultLabel = formatAccessLevel(workspaceDefault);

    return (
        <div className="flex items-center gap-3 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-fg">
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                </span>
                {override === null ? (
                    <span className="truncate text-xs text-fg-muted">
                        Workspace default
                    </span>
                ) : (
                    <span className="truncate text-xs text-gold">
                        Overridden
                        <span className="hidden sm:inline">
                            {" "}
                            for this document
                        </span>{" "}
                        · default
                        <span className="hidden sm:inline"> is</span>{" "}
                        {defaultLabel}
                    </span>
                )}
            </div>
            {canManage ? (
                <Select
                    variant="outline"
                    value={effective}
                    options={LEVEL_OPTIONS}
                    onChange={onChange}
                    disabled={isSaving}
                    label={`Workspace default: ${defaultLabel}`}
                    action={
                        override === null
                            ? undefined
                            : {
                                  label: "Reset to workspace default",
                                  onSelect: () => onChange(null),
                              }
                    }
                    className={`w-[6.5rem] sm:w-[7.5rem] ${override === null ? "" : "border-gold/70"}`}
                />
            ) : (
                <ReadOnlyAccess>{formatAccessLevel(effective)}</ReadOnlyAccess>
            )}
        </div>
    );
};

export default GeneralAccessRow;
