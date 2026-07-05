const express = require("express");
const { z } = require("zod");
const {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
} = require("express-unified-response");

const app = express();
app.use(express.json());
app.use(createResponseMiddleware());

// ── Schemas ───────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email:    z.string().email("Must be a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  age:      z.number({ required_error: "Age is required" }).min(18, "Must be 18 or older"),
  name:     z.string().min(2, "Name must be at least 2 characters").optional(),
});

const productSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  price:    z.number().positive("Price must be a positive number"),
  category: z.enum(["electronics", "furniture", "stationery", "other"], {
    errorMap: () => ({ message: "Category must be electronics, furniture, stationery, or other" }),
  }),
  dimensions: z
    .object({
      width:  z.number().positive("Width must be positive"),
      height: z.number().positive("Height must be positive"),
      depth:  z.number().positive("Depth must be positive").optional(),
    })
    .optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────
//
// schema.parse(req.body) throws a ZodError when validation fails.
// asyncHandler catches it and passes it to createErrorMiddleware, which
// normalises it to: 400 VALIDATION_ERROR with details: [{ field, message, code }]
//
// No try/catch. No z.safeParse. No manual error mapping.

app.post("/register", asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);

  // In a real app: hash password, persist to DB, generate token, etc.
  res.created(
    { email: body.email, name: body.name ?? null },
    "Account created"
  );
}));

app.post("/product", asyncHandler(async (req, res) => {
  const body = productSchema.parse(req.body);
  res.created(body, "Product created");
}));

// ── Error middleware ──────────────────────────────────────────────────────────

app.use(createErrorMiddleware());

const PORT = process.env.PORT ?? 3003;
app.listen(PORT, () =>
  console.log(`03-zod-validation → http://localhost:${PORT}`)
);