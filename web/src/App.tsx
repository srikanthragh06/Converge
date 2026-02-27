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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#1f1f1f" }}>
      <header style={{
        height: 56,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
        paddingInline: 24,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>
          Converge
        </span>
      </header>

      {/* Editor fills remaining height; overflow-auto handles long documents */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <BlockNoteView editor={editor} theme="dark" style={{ height: "100%" }} />
      </div>
    </div>
  );
}

export default App;
