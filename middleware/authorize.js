/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ["admin", "manager"])
 * @returns {Function} Express middleware function
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Role comes only from the signed token
    const userRole = req.user.role;

    if (!userRole || (allowedRoles.length > 0 && !allowedRoles.includes(userRole))) {
      return res.status(403).json({
        message: `Forbidden: Access restricted to ${allowedRoles.join(" or ")}`,
      });
    }

    next();
  };
};

module.exports = authorize;
