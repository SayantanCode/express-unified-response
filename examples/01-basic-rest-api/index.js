const express = require("express");
const {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  NotFoundError,
  ValidationError,
  AppError,
} = require("express-unified-response");

const app = express();
app.use(express.json());

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  createResponseMiddleware({
    restDefaults: {
      deleteReturnsNoContent: true, // DELETE → 204 with no body
    },
    logger: {
      onSuccess: (req, statusCode, durationMs) =>
        console.log(`  ${req.method} ${req.originalUrl} → ${statusCode} (${durationMs}ms)`),
      onError: (req, error, statusCode, durationMs) =>
        console.error(`  ${req.method} ${req.originalUrl} → ${statusCode} (${durationMs}ms) — ${error.message}`),
    },
  })
);

// ── In-memory store ───────────────────────────────────────────────────────────

let products = [
  { id: 1, name: "Laptop",     price: 999.99, category: "Electronics" },
  { id: 2, name: "Desk Chair", price: 249.99, category: "Furniture"   },
  { id: 3, name: "Notebook",   price:   4.99, category: "Stationery"  },
];
let nextId = 4;

function findProduct(id) {
  return products.find((p) => p.id === Number(id)) ?? null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/products", asyncHandler(async (_req, res) => {
  res.success(products, "Products retrieved");
}));

app.get("/products/:id", asyncHandler(async (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) throw new NotFoundError("Product not found");
  res.success(product);
}));

app.post("/products", asyncHandler(async (req, res) => {
  const { name, price, category } = req.body ?? {};
  const errors = [];

  if (!name || typeof name !== "string")
    errors.push({ field: "name", message: "Name is required" });
  if (price == null || typeof price !== "number" || price <= 0)
    errors.push({ field: "price", message: "Price must be a positive number" });
  if (!category || typeof category !== "string")
    errors.push({ field: "category", message: "Category is required" });

  if (errors.length) throw new ValidationError("Validation failed", errors);

  const product = { id: nextId++, name, price, category };
  products.push(product);
  res.created(product, "Product created");
}));

app.put("/products/:id", asyncHandler(async (req, res) => {
  const index = products.findIndex((p) => p.id === Number(req.params.id));
  if (index === -1) throw new NotFoundError("Product not found");

  products[index] = { ...products[index], ...req.body };
  res.updated(products[index], "Product updated");
}));

app.delete("/products/:id", asyncHandler(async (req, res) => {
  const index = products.findIndex((p) => p.id === Number(req.params.id));
  if (index === -1) throw new NotFoundError("Product not found");

  products.splice(index, 1);
  res.deleted();
}));

// ── Error demo routes ─────────────────────────────────────────────────────────

// Domain-specific error with a machine-readable code and structured details
app.get("/errors/custom", asyncHandler(async (req, res) => {
  throw new AppError("Product is out of stock", 409, "OUT_OF_STOCK", {
    productId: 42,
    expectedRestock: "2025-08-01",
  });
}));

// Programmer mistake (TypeError) — isOperational = false → client gets
// defaultErrorMessage ("Internal server error"), not the raw JS message
app.get("/errors/unhandled", asyncHandler(async (_req, _res) => {
  const obj = null;
  obj.property; // TypeError: Cannot read properties of null
}));

// ── Error middleware ──────────────────────────────────────────────────────────

app.use(createErrorMiddleware());

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`\n01-basic-rest-api → http://localhost:${PORT}\n`);
});