import { useState } from "react";
import { Avatar } from "../ui/Avatar";
import Button from "../ui/Button";
import Select, { type SelectOption } from "../ui/Select";

/**
 * The person found for a typed email, with a level or role dropdown and an
 * Add button — used by the Share dialog and the workspace Members tab.
 * Nothing changes until Add is pressed.
 * @param user - the person found by exact email
 * @param subtitle - muted line under the name (default: their email), e.g.
 *                   "rahul@example.com · not in this workspace yet"
 * @param options - the levels or roles the caller may give
 * @param defaultValue - the option selected at first
 * @param isAdding - disables the controls while the add request is in flight
 * @param onAdd - called with the chosen option
 */
const AddPersonCard = <T extends string>({
    user,
    subtitle,
    options,
    defaultValue,
    isAdding,
    onAdd,
}: {
    user: { name: string; email: string; avatarUrl: string | null };
    subtitle?: string;
    options: SelectOption<T>[];
    defaultValue: T;
    isAdding: boolean;
    onAdd: (value: T) => void;
}) => {
    const [value, setValue] = useState<T>(defaultValue); // option to give on Add

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
                    {subtitle ?? user.email}
                </span>
            </div>
            <Select
                variant="outline"
                value={value}
                options={options}
                onChange={setValue}
                disabled={isAdding}
                className="w-[6.5rem] bg-surface-elevated sm:w-[7.5rem]"
            />
            <Button
                variant="primary"
                onClick={() => onAdd(value)}
                disabled={isAdding}
                className="px-4 font-semibold"
            >
                Add
            </Button>
        </div>
    );
};

export default AddPersonCard;
