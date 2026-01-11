// example/app.ts

import express from "express";
import mongoose from "mongoose";
import {
  createResponseMiddleware,
  createErrorMiddleware,
  NotFoundError,
  ValidationError,
} from "../src";

const app = express();
app.use(express.json());

// attach response helpers
app.use(
  createResponseMiddleware({
    keys: {
      successKey: "success",
      dataKey: "data",
      metaKey: "meta",
      messageKey: "message",
      errorKey: "error",
    },
    pagination: {
      defaults: {
        page: 1,
        limit: 10,
        maxLimit: 50, // safe limit for paginated lists
      },
      labels: {
        nextPage: "next",
        prevPage: "prev",
        totalDocs: "totalItems",
        docs: "items",
        totalPages: "totalPages",
        limit: "perPage",
        page: "currentPage",
        hasPrevPage: "hasPrev",
        hasNextPage: "hasNext",
      },
    },
    restDefaults: {
      deleteReturnsNoContent: true,
      updateReturnsBody: true,
      nonPaginatedMaxItems: 1000, // safe limit for non-paginated lists
    },
  })
);

// simple Mongoose model for demo
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  age: { type: Number, required: true },
});

const UserModel = mongoose.model("User", userSchema);

// routes

// create user
app.post("/users", async (req, res) => {
  const user = await UserModel.create(req.body);
  // res.created(user, 'User created');
  if (!user) {
    throw new Error("User creation failed");
  } else {
    res.created(user, "User created");
  }
});

// list users (paginated)
app.get("/users", async (req, res) => {
  const page = Number(req.query.page) || undefined;
  const limit = Number(req.query.limit) || undefined;

  await res.paginateQuery(
    UserModel,
    {
      page,
      limit,
      filter: { active: true, age: { $gte: 18 } },
      lean: true,
    },
    "Active users"
  );
});

// list all tags‑like example (non‑paginated)
app.get("/users/all", async (req, res) => {
  const users = await UserModel.find({ active: true }).limit(1000).lean();
  res.list(users, "All active users");
});

// get single user
app.get("/users/:id", async (req, res) => {
  const user = await UserModel.findById(req.params.id).lean();
  if (!user) throw new NotFoundError("User not found");
  res.success(user, "User fetched");
});

// delete user
app.delete("/users/:id", async (req, res) => {
  const user = await UserModel.findByIdAndDelete(req.params.id);
  if (!user) throw new NotFoundError("User not found");
  res.deleted(); // 204 by default
});
// validation error example
app.post("/users/validate", async (req, res) => {
  const { name, email, age } = req.body;
  if (!name || !email || !age) {
    throw new ValidationError("Missing required fields", [
      {
        field: "name",
        message: "Name is required",
      },
      {
        field: "email",
        message: "Email is required",
      },
      {
        field: "age",
        message: "Age is required",
      },
    ])
  }
  const user = await UserModel.create(req.body);
  if(!user) {
    res.error("User creation failed");
  } else {
    res.created(user, "User created");
  }
});
// error middleware (must be after routes)
app.use(createErrorMiddleware());

// bootstrap
async function start() {
  await mongoose.connect("mongodb://localhost:27017/response-demo");
  app.listen(3000, () => {
    console.log("Example app listening on port 3000");
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
