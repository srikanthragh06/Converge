import { BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";

/** Extended BlockNote schema that adds syntax-highlighted code blocks with on-demand language loading. */
const editorSchema = BlockNoteSchema.create({
    blockSpecs: {
        ...BlockNoteSchema.create().blockSpecs,
        codeBlock: createCodeBlockSpec(codeBlockOptions),
    },
});

export default editorSchema;
