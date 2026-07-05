require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  BadRequestError,
  NotFoundError,
} = require("express-unified-response");
const { requireAuth, requireRole, SECRET } = require("./middleware/auth");

const app = express();
app.use(express.json());
app.use(createResponseMiddleware());

// ── Seed "database" ───────────────────────────────────────────────────────────
// In a real app passwords would be hashed (bcrypt) and stored in a database.
const users = [
  { id: 1, email: "user@example.com",  password: "password123", role: "user",  name: "John User"  },
  { id: 2, email: "admin@example.com", password: "admin123",    role: "admin", name: "Jane Admin" },
];

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    throw new BadRequestError("email and password are required");

  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) throw new NotFoundError("Invalid credentials");

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    SECRET,
    { expiresIn: "1h" }
  );

  res.success({ token, expiresIn: "1h" }, "Login successful");
}));

// ── Protected routes ──────────────────────────────────────────────────────────

app.get("/profile", requireAuth, asyncHandler(async (req, res) => {
  res.success(req.user, "Profile retrieved");
}));

// requireRole("admin") throws ForbiddenError (403) if req.user.role !== "admin"
app.get("/admin", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  res.success(
    { message: "Welcome to the admin panel", user: req.user },
    "Admin access granted"
  );
}));

// ── Demo / test routes ────────────────────────────────────────────────────────

// Creates an already-expired token and verifies it.
// jwt.verify throws TokenExpiredError → auto-mapped to 401 "Token expired".
app.get("/auth/test/expired", asyncHandler(async (_req, _res) => {
  const expiredToken = jwt.sign({ test: true }, SECRET, { expiresIn: -1 });
  jwt.verify(expiredToken, SECRET);
}));

// Passes a garbage string to jwt.verify.
// Throws JsonWebTokenError → auto-mapped to 401 "Invalid authentication token".
app.get("/auth/test/invalid", asyncHandler(async (_req, _res) => {
  jwt.verify("this.is.not.a.valid.token", SECRET);
}));

// ── Error middleware ──────────────────────────────────────────────────────────

app.use(createErrorMiddleware());

const PORT = process.env.PORT ?? 3004;
app.listen(PORT, () =>
  console.log(`04-jwt-auth → http://localhost:${PORT}`)
);