import express, { Request, Response } from "express";
import mongoose, { Document } from "mongoose";
import {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "../dist"; // Importing from dist as requested

const app = express();
app.use(express.json());

// ============================================================================
// 1. MIDDLEWARE CONFIGURATION
// ============================================================================
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
      defaults: { page: 1, limit: 10, maxLimit: 50 },
      labels: {
        nextPage: "next", prevPage: "prev", totalDocs: "totalItems",
        docs: "items", totalPages: "totalPages", limit: "perPage",
        page: "currentPage", hasPrevPage: "hasPrev", hasNextPage: "hasNext",
      },
    },
    restDefaults: {
      deleteReturnsNoContent: true,
      updateReturnsBody: true,
      nonPaginatedMaxItems: 1000,
    },
  })
);

// ============================================================================
// 2. MONGOOSE MODEL & HOOKS
// ============================================================================
interface IUser extends Document {
  name: string;
  email: string;
  active: boolean;
  age: number;
}

const userSchema = new mongoose.Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  age: { type: Number, required: true },
});

userSchema.pre("validate", asyncHandler(async function (this: IUser, next: (err?: Error) => void) {
  // Simulating an async check
  await new Promise(resolve => setTimeout(resolve, 10));
  
  if (this.age !== undefined && this.age < 0) {
    throw new ValidationError("Age cannot be negative", [{ field: "age", message: "Must be a positive number", value: this.age, code: "MIN_AGE" }]);
  }
  next();
}) as any);

const UserModel = mongoose.model<IUser>("User", userSchema);

// ============================================================================
// 3. COMPREHENSIVE ROUTES & SCENARIOS
// ============================================================================

// Scenario A: Creating resources (res.created)
app.post("/users", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.create(req.body);
  
  res.created(user, "User successfully created", {
    transform: (doc: Document) => {
      const { __v, ...rest } = (doc as any).toObject ? (doc as any).toObject() : doc;
      return rest;
    }
  });
}));

// Scenario B: Paginated Query via Mongoose Models (res.paginateQuery)
app.get("/users", asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  await res.paginateQuery(
    UserModel,
    {
      page,
      limit,
      filter: { active: true },
      sort: { _id: -1 },
      lean: true,
      select: "-__v",
    },
    "Paginated users fetched successfully"
  );
}));

// Scenario C: Paginated Aggregation Pipelines (res.paginateAggregate)
app.get("/users/stats", asyncHandler(async (req: Request, res: Response) => {
  const pipeline = [
    { $match: { active: true } },
    { $group: { _id: "$age", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ];

  await res.paginateAggregate(
    UserModel,
    {
      pipeline,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    },
    "User age statistics"
  );
}));

// Scenario D: Fetching un-paginated lists (res.list)
app.get("/users/all", asyncHandler(async (req: Request, res: Response) => {
  const users = await UserModel.find({ active: true }).limit(50).lean();
  
  res.list(users, { paginate: false }, "All active users retrieved");
}));

// Scenario E: Fetching a single resource (res.success) & Throwing NotFoundError
app.get("/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.params.id).lean();
  
  if (!user) {
    throw new NotFoundError(`User with ID ${req.params.id} not found`);
  }
  
  res.success(user, "User details fetched");
}));

// Scenario F: Updating resources (res.updated)
app.put("/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  
  if (!user) throw new NotFoundError("User not found");
  
  res.updated(user, "User updated successfully");
}));

// Scenario G: Deleting resources (res.deleted)
app.delete("/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findByIdAndDelete(req.params.id);
  
  if (!user) throw new NotFoundError("User not found");
  
  res.deleted(); 
}));

// Scenario H: Throwing other HTTP Errors for demonstration
app.get("/error/unauthorized", asyncHandler(async (req: Request, res: Response) => {
  throw new UnauthorizedError("You must be logged in to access this");
}));

app.get("/error/forbidden", asyncHandler(async (req: Request, res: Response) => {
  throw new ForbiddenError("You do not have permission to perform this action");
}));

app.get("/error/bad-request", asyncHandler(async (req: Request, res: Response) => {
  throw new BadRequestError("The parameters provided are invalid");
}));

app.post("/error/validation", asyncHandler(async (req: Request, res: Response) => {
  throw new ValidationError("Invalid payload", [
    { field: "password", message: "Password must be at least 8 characters long", value: "", code: "MIN_LENGTH" }
  ]);
}));

app.get("/error/generic", asyncHandler(async (req: Request, res: Response) => {
  throw new Error("Something went horribly wrong in the database!");
}));

app.get("/error/app-error", asyncHandler(async (req: Request, res:Response)=>{
  throw new AppError("Any message then status code", 400)
}))

// ============================================================================
// 4. GLOBAL ERROR HANDLER
// ============================================================================
app.use(createErrorMiddleware({
  logger: {
    onError: (req?: any, error?: AppError | Error, statusCode?: number, durationMs?: number) => {
      console.error(`[ERROR] ${req?.method} ${req?.originalUrl} -> ${statusCode} (${durationMs}ms):`, error?.message);
    }
  }
}));

// ============================================================================
// 5. BOOTSTRAP APPLICATION
// ============================================================================
async function start() {
  try {
    app.listen(3000, () => {
      console.log("Comprehensive example app listening on port 3000");
    });
  } catch (err) {
    console.error("Failed to start application:", err);
    process.exit(1);
  }
}

start();
