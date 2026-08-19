// @blocknote/core, @blocknote/code-block, and @blocknote/server-util all ship
// ESM-only under their "import" condition. This package compiles to
// CommonJS, so a static `import` of any of them resolves to their "require"
// condition instead — and @blocknote/server-util's CJS bundle synchronously
// requires @blocknote/core's CJS bundle, which itself requires
// @handlewithcare/prosemirror-inputrules (a transitive dependency that is
// ESM-only with no "require" condition at all) and crashes the whole process
// at module-load time with ERR_PACKAGE_PATH_NOT_EXPORTED. A dynamic import()
// goes through Node's real ESM resolver instead, picking each package's
// "import" condition — which is fully self-consistent ESM all the way down —
// so everything here must stay behind dynamic import(), never a static one.
async function buildServerEditor() {
  const { ServerBlockNoteEditor } = await import('@blocknote/server-util');
  const { BlockNoteSchema, createCodeBlockSpec } = await import('@blocknote/core');
  const { codeBlockOptions } = await import('@blocknote/code-block');

  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...BlockNoteSchema.create().blockSpecs,
      codeBlock: createCodeBlockSpec(codeBlockOptions),
    },
  });

  return ServerBlockNoteEditor.create({ schema });
}

let editorPromise: ReturnType<typeof buildServerEditor> | undefined;

function getServerEditor() {
  if (!editorPromise) editorPromise = buildServerEditor();
  return editorPromise;
}

/**
 * Converts a Yjs update into Markdown via the app's BlockNote schema.
 *
 * Takes raw update bytes rather than an already-live Y.Doc (e.g. from
 * DocumentYjsService.loadDoc) because yjs does not support being loaded
 * twice in one process (https://github.com/yjs/yjs/issues/438):
 * document-yjs.service.ts loads yjs via a static (CommonJS) import, while
 * @blocknote/core above can only be loaded via dynamic import(), which pulls
 * in y-prosemirror's own dynamically-imported yjs — a second, incompatible
 * module realm. A Y.Text built by one realm fails y-prosemirror's
 * constructor checks in the other ("text.toDelta is not a function"). A Yjs
 * update is realm-agnostic binary, so re-applying it to a Doc built by
 * *this* realm's yjs (imported below) sidesteps the mismatch entirely.
 * @param update - encoded Yjs update bytes for the document to convert
 */
export async function markdownFromYjsUpdate(update: Uint8Array): Promise<string> {
  const Y = await import('yjs');
  const yDoc = new Y.Doc();
  Y.applyUpdate(yDoc, update);

  const editor = await getServerEditor();
  const blocks = editor.yDocToBlocks(yDoc, 'blocknote');
  return editor.blocksToMarkdownLossy(blocks);
}
