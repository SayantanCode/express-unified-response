require("dotenv").config();
const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  FileUploadError,
  ExternalServiceError,
  UnauthorizedError,
} = require("express-unified-response");

const app = express();
app.use(express.json());

// ── S3 client ─────────────────────────────────────────────────────────────────

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

// ── Custom adapter — maps AWS SDK v3 exceptions to structured errors ───────────
//
// Without this adapter, S3 exceptions fall through to the generic 500 handler.
// The adapter checks for err.$fault (present on all AWS SDK v3 service errors)
// and maps known error names to meaningful FileUploadError / ExternalServiceError.
//
// Multer error codes (LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE) are still handled
// by the built-in detection — the s3Adapter only covers S3-specific errors.

const s3Adapter = (err) => {
  if (!err?.$fault) return null; // not an AWS SDK error — skip

  switch (err.name) {
    case "NoSuchBucket":
      return new FileUploadError("S3 bucket not found — check AWS_BUCKET_NAME");
    case "AccessDenied":
      return new FileUploadError("S3 access denied — check IAM permissions");
    case "EntityTooLarge":
      return new FileUploadError("File exceeds the S3 bucket maximum object size");
    case "InvalidAccessKeyId":
    case "SignatureDoesNotMatch":
      return new UnauthorizedError("Invalid AWS credentials");
    default:
      return new ExternalServiceError("S3 upload failed", {
        code:    err.name,
        message: err.message,
      });
  }
};

const config = { adapters: [s3Adapter] };
app.use(createResponseMiddleware(config));

// ── Multer with S3 storage ────────────────────────────────────────────────────

const imageFilter = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  if (allowed.includes(path.extname(file.originalname).toLowerCase()))
    return cb(null, true);
  cb(new Error("Only image files are allowed"), false);
};

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) =>
      cb(null, `uploads/${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB per file
  fileFilter: imageFilter,
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.post(
  "/upload/single",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error("No file received");
    res.created(
      {
        key:      req.file.key,
        location: req.file.location,
        size:     req.file.size,
        mimetype: req.file.mimetype,
      },
      "File uploaded to S3"
    );
  })
);

app.post(
  "/upload/multiple",
  upload.array("images", 5),
  asyncHandler(async (req, res) => {
    const files = req.files ?? [];
    res.created(
      files.map((f) => ({ key: f.key, location: f.location, size: f.size })),
      `${files.length} file(s) uploaded to S3`
    );
  })
);

// ── Error middleware ──────────────────────────────────────────────────────────

app.use(createErrorMiddleware(config));

const PORT = process.env.PORT ?? 3005;
app.listen(PORT, () =>
  console.log(`05-file-upload (S3) → http://localhost:${PORT}`)
);