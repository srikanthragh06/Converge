import { useState } from "react";
import type {
    DocumentAccessLevel,
    FindNewDocumentAccessUserResponseDto,
} from "@converge/shared";
import { Avatar } from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Select, { type SelectOption } from "../../../components/ui/Select";

/**
 * The person found for the typed email, with a level dropdown (Editor by
 * default) and an Add button. Nothing is granted until Add is pressed.
 * @param user - the person found by exact email
 * @param options - levels the caller may grant (admins can't grant Admin)
 * @param isAdding - disables the controls while the add request is in flight
 * @param onAdd - called with the chosen level
 */
const AddPersonCard = ({
    user,
    options,
    isAdding,
    onAdd,
}: {
    user: FindNewDocumentAccessUserResponseDto;
    options: SelectOption<DocumentAccessLevel>[];
    isAdding: boolean;
    onAdd: (access: DocumentAccessLevel) => void;
}) => {
    const [access, setAccess] = useState<DocumentAccessLevel>("editor"); // level to grant on Add

    return (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-inset p-3">
            <Avatar
                name={user.name}
                src={user.avatarUrl}
                colorKey={user.email}
                className="h-8 w-8 text-xs"
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-fg">{user.name}</span>
                <span className="truncate text-xs text-fg-muted">
                    {user.email}
                </span>
            </div>
            <Select
                variant="outline"
                value={access}
                options={options}
                onChange={setAccess}
                disabled={isAdding}
                className="w-[6.5rem] bg-surface-elevated sm:w-[7.5rem]"
            />
            <Button
                variant="primary"
                onClick={() => onAdd(access)}
                disabled={isAdding}
                className="px-4 font-semibold"
            >
                Add
            </Button>
        </div>
    );
};

export default AddPersonCard;
