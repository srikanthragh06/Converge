// Generic fallback message for unhandled exceptions — intentionally vague to avoid leaking internals to clients.
export const INTERNAL_SERVER_ERROR_MESSAGE = "Internal Server Error";

// Wrap each matched word in a lexical content-search snippet. Unicode
// private-use characters: they don't occur in normal text, and they survive
// the server's Markdown stripping untouched, so the client can split on them
// to render highlights without raw HTML.
export const SEARCH_HIGHLIGHT_START = "\uE000";
export const SEARCH_HIGHLIGHT_END = "\uE001";
