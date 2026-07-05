require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  FileUploadError,
} = require("express-unified-response");

const app = express();
app.use(express.json());
app.use(createResponseMiddleware());

// ── Multer — disk storage ─────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const imageFilter = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  if (allowed.includes(path.extname(file.originalname).toLowerCase()))
    return cb(null, true);
  // FileUploadError → 400, not a plain Error (which would mask as a 500)
  cb(new FileUploadError("Only image files are allowed"), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB per file
  fileFilter: imageFilter,
});

// ── Routes ────────────────────────────────────────────────────────────────────
//
// Multer calls next(err) when a limit is exceeded.
// createErrorMiddleware detects:
//   LIMIT_FILE_SIZE       → 400 "File size limit exceeded"
//   LIMIT_UNEXPECTED_FILE → 400 "Unexpected file field"
// No extra code needed — just use createErrorMiddleware().

app.post(
  "/upload/single",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error("No file received");
    res.created(
      {
        filename: req.file.filename,
        size:     req.file.size,
        mimetype: req.file.mimetype,
        path:     req.file.path,
      },
      "File uploaded"
    );
  })
);

app.post(
  "/upload/multiple",
  upload.array("images", 5),
  asyncHandler(async (req, res) => {
    const files = req.files ?? [];
    res.created(
      files.map((f) => ({ filename: f.filename, size: f.size, mimetype: f.mimetype })),
      `${files.length} file(s) uploaded`
    );
  })
);

// ── Error middleware ──────────────────────────────────────────────────────────

app.use(createErrorMiddleware());

const PORT = process.env.PORT ?? 3005;
app.listen(PORT, () =>
  console.log(`05-file-upload (local) → http://localhost:${PORT}`)
);