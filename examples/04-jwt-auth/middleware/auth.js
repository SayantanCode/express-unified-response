const jwt = require("jsonwebtoken");
const { asyncHandler, UnauthorizedError, ForbiddenError } = require("express-unified-response");

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";

// Extracts and verifies the Bearer token from the Authorization header.
// jwt.verify() throws TokenExpiredError or JsonWebTokenError on bad tokens —
// asyncHandler propagates both to createErrorMiddleware, which maps them to 401 automatically.
const requireAuth = asyncHandler((req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    throw new UnauthorizedError("No token provided");

  req.user = jwt.verify(header.slice(7), SECRET);
  next();
});

// Higher-order middleware: returns an asyncHandler that checks req.user.role.
const requireRole = (role) =>
  asyncHandler((req, _res, next) => {
    if (req.user?.role !== role)
      throw new ForbiddenError(`This route requires the '${role}' role`);
    next();
  });

module.exports = { requireAuth, requireRole, SECRET };