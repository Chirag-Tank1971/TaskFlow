const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate requests using JWT from the HttpOnly cookie or Authorization header.
 * Tokens in the query string are not accepted: URLs end up in logs, history and Referer headers.
 */
const authenticate = (req, res, next) => {
  let token = null;

  // Check Authorization header (non-browser API clients)
  const authHeader = req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    // Check cookie
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Access Denied: Authentication token required" });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    // Legacy tokens without id/role must re-authenticate; role is never guessed
    if (!verified.id || !verified.role) {
      return res.status(401).json({ message: "Session expired, please log in again" });
    }

    req.user = verified;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired authentication token" });
  }
};

module.exports = authenticate;
