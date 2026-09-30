/**
 * Split document text into overlapping chunks for embedding.
 * ~4 characters ≈ 1 token, so the defaults are roughly 800-token chunks with 100-token overlap.
 * Splits on paragraph, then sentence boundaries so chunks don't cut thoughts in half.
 */
const DEFAULT_CHUNK_SIZE = 3200;
const DEFAULT_OVERLAP = 400;

const splitLongPiece = (piece, size) => {
  // Fall back to sentence boundaries, then hard cuts, for very long paragraphs
  const sentences = piece.match(/[^.!?\n]+[.!?]*\s*/g) || [piece];
  const out = [];
  let current = "";
  for (const s of sentences) {
    if (s.length > size) {
      if (current) out.push(current);
      current = "";
      for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
      continue;
    }
    if ((current + s).length > size) {
      out.push(current);
      current = "";
    }
    current += s;
  }
  if (current) out.push(current);
  return out;
};

const chunkText = (text, { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}) => {
  const clean = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];

  const pieces = clean
    .split(/\n\n+/)
    .flatMap((p) => (p.length > chunkSize ? splitLongPiece(p, chunkSize) : [p]))
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";
  for (const piece of pieces) {
    if (current && (current + "\n\n" + piece).length > chunkSize) {
      chunks.push(current);
      // Carry the tail of the previous chunk forward so context isn't lost at boundaries
      const tail = current.slice(-overlap);
      const cut = tail.search(/\s/);
      current = (cut >= 0 ? tail.slice(cut + 1) : tail) + "\n\n" + piece;
    } else {
      current = current ? current + "\n\n" + piece : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

module.exports = { chunkText };
