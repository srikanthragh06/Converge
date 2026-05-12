import { Button } from "@/components/ui/button";
import AvatarHeader from "../../../components/AvatarHeader";

/**
 * Top navigation bar for the library page. Same layout as EditorPageHeader
 * but without the Manage Document button or sync status indicator.
 */
const LibraryPageHeader = () => {
    return (
        <div className="sticky top-0 z-50 bg-background-base flex justify-between items-center sm:px-8 px-2 py-2">
            <Button variant="default" size="sm">
                New Doc
            </Button>
            <div className="flex items-center sm:py-2">
                <AvatarHeader />
            </div>
        </div>
    );
};

export default LibraryPageHeader;
