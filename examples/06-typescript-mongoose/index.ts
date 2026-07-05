import "dotenv/config";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  NotFoundError,
  ResponseConfig,
} from "express-unified-response";
import { UserModel, IUser } from "./models/user.js";

const app = express();
app.use(express.json());

// Fully typed config — IDE autocomplete works on every field here.
const config: ResponseConfig = {
  pagination: {
    defaults: { page: 1, limit: 10, maxLimit: 50 },
  },
};

app.use(createResponseMiddleware(config));

// ── DTO shape returned to clients — never leaks Mongoose internals ───────────

interface UserDTO {
  id: string;
  name: string;
  email: string;
}

const toUserDTO = (user: IUser): UserDTO => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

// ── Routes ────────────────────────────────────────────────────────────────────
//
// None of the calls below annotate <T, R> explicitly — TypeScript infers them
// from `user`'s type and `toUserDTO`'s return type. res.success/created/etc.
// only exist on `res` because of this package's `res.*` module augmentation;
// there is no cast or `as any` anywhere in this file.

app.post("/users", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.create(req.body);
  res.created(user, "User created", { transform: toUserDTO });
}));

app.get("/users", asyncHandler(async (req: Request, res: Response) => {
  await res.paginateQuery(
    UserModel,
    {
      page: req.query.page as string,
      limit: req.query.limit as string,
      filter: { active: true },
      sort: { createdAt: -1 },
      lean: true,
      transform: toUserDTO,
    },
    "Users fetched"
  );
}));

app.get("/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new NotFoundError("User not found");
  res.success(user, "User fetched", { transform: toUserDTO });
}));

app.put("/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) throw new NotFoundError("User not found");
  res.updated(user, "User updated", { transform: toUserDTO });
}));

app.delete("/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findByIdAndDelete(req.params.id);
  if (!user) throw new NotFoundError("User not found");
  res.deleted();
}));

// ── Error middleware — same config object as createResponseMiddleware ────────

app.use(createErrorMiddleware(config));

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function start() {
  const uri = process.env.MONGO_URI ?? "mongodb://localhost:27017/eur-ts-example";
  await mongoose.connect(uri);
  console.log("MongoDB connected");

  const PORT = Number(process.env.PORT) || 3006;
  app.listen(PORT, () =>
    console.log(`06-typescript-mongoose → http://localhost:${PORT}`)
  );
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
