import { BlockNoteSchema, createCodeBlockSpec, type Block } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";

/** Extended BlockNote schema that adds syntax-highlighted code blocks with on-demand language loading. */
const editorSchema = BlockNoteSchema.create({
    blockSpecs: {
        ...BlockNoteSchema.create().blockSpecs,
        codeBlock: createCodeBlockSpec(codeBlockOptions),
    },
});

export default editorSchema;

/** A single block in this app's document schema — the shape returned by editor.document and yDocToBlocks. */
export type DocumentBlock = Block<
    typeof editorSchema.blockSchema,
    typeof editorSchema.inlineContentSchema,
    typeof editorSchema.styleSchema
>;
