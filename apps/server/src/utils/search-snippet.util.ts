// Longest snippet sent to the ⌘K palette, which shows two lines at most.
const SNIPPET_MAX_CHARS = 240;

/**
 * Removes Unicode private-use characters (U+E000–U+F8FF). The highlight
 * markers are private-use characters, and imported documents (e.g. from a
 * PDF) can hold their own, which would otherwise read as markers. Run it on
 * a chunk before any markers are added.
 * @param text - raw chunk content
 * @returns the text without private-use characters
 */
export function removePrivateUseCharacters(text: string): string {
  return text.replace(/[\uE000-\uF8FF]/g, '');
}

/**
 * Turns chunk Markdown (or a ts_headline window of it) into a one-line
 * plain-text snippet of at most SNIPPET_MAX_CHARS. Removes the Markdown
 * syntax that would show as noise; keeps the highlight markers.
 * @param markdown - the chunk's Markdown
 * @returns the snippet text
 */
export function toSnippet(markdown: string): string {
  let text = markdown;
  text = text.replace(/^\s*```.*$/gm, ''); // code fence lines
  text = text.replace(/^[\s|:-]*-{3,}[\s|:-]*$/gm, ''); // table separator rows, horizontal rules
  text = text.replace(/^\s*(#{1,6}|>|[*+-] \[[ xX]\]|[*+-]|\d+\.)\s+/gm, ''); // heading, quote, checklist, list markers
  text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'); // links and images: keep their text
  text = text.replace(/\*\*|__|~~|`/g, ''); // bold, strikethrough, inline code
  text = text.replace(/(?<![\w\\])[*_](?=\S)|(?<=[^\s\\])[*_](?!\w)/g, ''); // italic; leaves snake_case alone
  text = text.replace(/\|/g, ' '); // table cell pipes
  text = text.replace(/\\([\s\S])/g, '$1'); // escaped characters and hard line breaks
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (entity: string, hex: string) => {
    const codePoint = parseInt(hex, 16);
    if (codePoint > 0x10ffff) return entity; // fromCodePoint would throw
    return String.fromCodePoint(codePoint);
  });
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= SNIPPET_MAX_CHARS) return text;

  // Cut at a space, so a highlighted word (a single token, no spaces) is
  // never split. Only text with no space at all is cut mid-word.
  let cut = text.lastIndexOf(' ', SNIPPET_MAX_CHARS);
  if (cut <= 0) cut = SNIPPET_MAX_CHARS;
  return text.slice(0, cut) + '…';
}
