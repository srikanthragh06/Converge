import { useAtomValue } from "jotai";
import { openDocumentTitleAtom } from "@/atoms/document";

/**
 * What a new, empty conversation shows (p69): a serif "What can I help
 * with?" and a line on what the agent can do, naming the document open in
 * the editor, if any.
 */
const AgentEmptyState = () => {
    const documentTitle = useAtomValue(openDocumentTitleAtom); // the editor's document, or null on other pages

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-8 text-center">
            <h2 className="font-serif text-[30px] font-medium leading-tight text-fg">
                What can I help with?
            </h2>
            <p className="max-w-[26rem] text-sm leading-relaxed text-fg-secondary">
                I can find, read, summarize and edit documents in this workspace
                {documentTitle && <>, including “{documentTitle}”</>}, and
                restore past versions.
            </p>
        </div>
    );
};

export default AgentEmptyState;
