import { useAtomValue } from "jotai";
import { authAtom } from "../../../atoms/auth";
import AnimatedDots from "../../../components/AnimatedDots";

/**
 * Sticky top navigation bar for the editor page. Shows the document title on
 * the left, and on the right: a loading indicator while the document is
 * fetching, the Manage Document button, and the user's avatar.
 */
const EditorPageHeader = ({
    title,
    documentStatus,
}: {
    title: string;
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
}) => {
    const { user } = useAtomValue(authAtom); // authenticated user, used to display the avatar

    return (
        <div
            className="bg-background-base sticky top-0 left-0 right-0 z-50
             flex justify-between sm:px-8 px-2 py-2 "
        >
            <div className="flex h-full items-center">
                <span className="text-white sm:text-sm text-xs">{title}</span>
            </div>
            <div className="flex items-center space-x-8 sm:py-2">
                {documentStatus === "loading" && (
                    <span className="text-text-secondary sm:text-sm text-xs opacity-40">
                        Loading
                        <AnimatedDots />
                    </span>
                )}
                <button
                    className="sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-background-overlay text-white
                    border-none 
                    hover:opacity-90 active:opacity-80 transition cursor-pointer"
                >
                    Manage Document
                </button>
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
