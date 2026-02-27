import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import * as Y from "yjs";

// Module-level Y.Doc — stable across re-renders, shared for the lifetime of the page.
// v0.02 is local-only; v0.03 sync hooks will attach to this same instance.
const yDoc = new Y.Doc();

function App() {
  const editor = useCreateBlockNote({
    // Bind the editor to the Yjs XML fragment — the shared data structure BlockNote
    // uses internally. "blocknote" is the established key convention.
    // `as any` works around a typing gap in BlockNote's collaboration option.
    collaboration: {
      fragment: yDoc.getXmlFragment("blocknote"),
    } as any,

    // Intercept plain-text pastes and treat them as markdown.
    // Lets AI-generated markdown paste as formatted blocks instead of raw text.
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      if (event.clipboardData?.types.includes("text/plain")) {
        editor.pasteMarkdown(event.clipboardData.getData("text/plain"));
        return true;
      }
      return defaultPasteHandler();
    },
  });

  return (
    // Full-screen column: fixed header + scrollable editor area below
    <div className="flex flex-col h-screen bg-[#1f1f1f]">
      <header className="h-14 border-b border-white/10 flex items-center px-6 shrink-0">
        <span className="text-2xl font-bold text-white font-[Inter,sans-serif]">
          Converge
        </span>
      </header>

      {/* Editor fills remaining height; overflow-auto handles long documents */}
      <div className="flex-1 overflow-auto">
        <BlockNoteView editor={editor} theme="dark" className="h-full" />
      </div>
    </div>
  );
}

export default App;
