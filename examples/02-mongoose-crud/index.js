require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  NotFoundError,
} = require("express-unified-response");
const User = require("./models/user");

const app = express();
app.use(express.json());
app.use(createResponseMiddleware());

// Strip __v from Mongoose documents before sending
const stripMeta = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { __v, ...rest } = obj;
  return rest;
};

// ── Routes ────────────────────────────────────────────────────────────────────

// Offset pagination — GET /users?page=1&limit=10&active=true
app.get("/users", asyncHandler(async (req, res) => {
  await res.paginateQuery(
    User,
    {
      page:   req.query.page  ? Number(req.query.page)  : undefined,
      limit:  req.query.limit ? Number(req.query.limit) : undefined,
      filter: { active: true },
      sort:   { createdAt: -1 },
      select: "-__v",
      lean:   true,
    },
    "Users retrieved"
  );
}));

// Aggregate pagination — GET /users/stats
// Must be declared before /users/:id so Express doesn't treat "stats" as an id
app.get("/users/stats", asyncHandler(async (req, res) => {
  await res.paginateAggregate(
    User,
    {
      page:     req.query.page  ? Number(req.query.page)  : 1,
      limit:    req.query.limit ? Number(req.query.limit) : 10,
      pipeline: [
        {
          $group: {
            _id:    "$role",
            total:  { $sum: 1 },
            active: { $sum: { $cond: ["$active", 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ],
    },
    "User stats by role"
  );
}));

// Cursor pagination — GET /users/cursor?limit=5&cursor=<lastId>
// Pass the nextCursor value from the previous response as the cursor query param
app.get("/users/cursor", asyncHandler(async (req, res) => {
  await res.paginateCursor(
    User,
    {
      cursorField: "_id",
      cursor:      req.query.cursor,
      limit:       req.query.limit ? Number(req.query.limit) : 5,
      filter:      { active: true },
      sort:        { _id: -1 },
    },
    "Users (cursor page)"
  );
}));

// Single user — GET /users/:id
// An invalid ObjectId triggers a CastError → auto-mapped to 400 BAD_REQUEST "Invalid ID format"
app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-__v").lean();
  if (!user) throw new NotFoundError("User not found");
  res.success(user);
}));

// Create — POST /users
// Mongoose ValidationError → 400 VALIDATION_ERROR with per-field details (auto-detected)
// Duplicate email (11000) → 400 BAD_REQUEST with the duplicate field name (auto-detected)
app.post("/users", asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  res.created(stripMeta(user), "User created");
}));

// Update — PUT /users/:id
app.put("/users/:id", asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new:            true,
    runValidators:  true,
  });
  if (!user) throw new NotFoundError("User not found");
  res.updated(stripMeta(user), "User updated");
}));

// Delete — DELETE /users/:id
app.delete("/users/:id", asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new NotFoundError("User not found");
  res.deleted();
}));

app.use(createErrorMiddleware());

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function start() {
  const uri = process.env.MONGO_URI ?? "mongodb://localhost:27017/eur-example";
  await mongoose.connect(uri);
  console.log("MongoDB connected");

  const PORT = process.env.PORT ?? 3002;
  app.listen(PORT, () =>
    console.log(`02-mongoose-crud → http://localhost:${PORT}`)
  );
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});