// Escape user input so it is matched literally inside a RegExp (prevents ReDoS / regex injection)
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = escapeRegex;
