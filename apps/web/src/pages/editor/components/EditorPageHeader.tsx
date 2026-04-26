import { useAtomValue } from "jotai";
import { authAtom } from "../../../atoms/auth";

/**
 * Sticky top navigation bar for the editor page. Displays the document title
 * on the left and the authenticated user's avatar on the right.
 */
const EditorPageHeader = ({ title }: { title: string }) => {
    const { user } = useAtomValue(authAtom); // authenticated user, used to display the avatar

    return (
        <div
            className="bg-background-base sticky top-0 left-0 right-0 z-50
             flex justify-between sm:px-8 px-2 py-2 "
        >
            <div className="flex h-full items-center">
                <span className="text-white sm:text-sm text-xs">{title}</span>
            </div>
            <div className="flex items-center sm:py-2">
                {user?.avatarUrl && (
                    <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="sm:w-10 sm:h-10 h-6 w-6 rounded-full object-cover
                        cursor-pointer hover:opacity-80 transition"
                    />
                )}
            </div>
        </div>
    );
};

export default EditorPageHeader;
