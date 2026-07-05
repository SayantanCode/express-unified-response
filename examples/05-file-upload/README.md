# 05 — File Upload

Two entry points in the same folder:

- **`index.js`** — Multer disk storage, works with no credentials
- **`s3.js`** — AWS S3 via multer-s3, with a custom S3 error adapter registered

## Run (local disk)

```bash
npm install
npm start
# → http://localhost:3005
```

## Run (S3)

```bash
cp .env.example .env   # fill in AWS_* values
npm run start:s3
# → http://localhost:3005
```

## Endpoints (same for both)

| Method | Path | Field name | Limit |
|--------|------|-----------|-------|
| `POST` | `/upload/single` | `image` | 2 MB, images only |
| `POST` | `/upload/multiple` | `images` | up to 5 files, 2 MB each |

## Error scenarios

```bash
# File too large → 400 "File size limit exceeded" (LIMIT_FILE_SIZE auto-caught)
curl -X POST http://localhost:3005/upload/single -F "image=@large-file.jpg"

# Wrong field name → 400 "Unexpected file field" (LIMIT_UNEXPECTED_FILE auto-caught)
curl -X POST http://localhost:3005/upload/single -F "photo=@image.jpg"

# Wrong file type → 400 "Only image files are allowed" (fileFilter throws FileUploadError)
curl -X POST http://localhost:3005/upload/single -F "image=@document.pdf"
```

## What to notice

- Multer error codes (`LIMIT_FILE_SIZE`, `LIMIT_UNEXPECTED_FILE`) are caught by the built-in detection in `createErrorMiddleware` — no adapter or extra code needed
- `imageFilter` rejects disallowed extensions with `FileUploadError`, not a plain `Error` — a plain `Error` would be treated as an unexpected 500 instead of the correct 400 client error
- `s3.js` registers an `s3Adapter` that maps AWS SDK v3 exceptions (`AccessDenied`, `NoSuchBucket`, etc.) to structured `FileUploadError` / `ExternalServiceError` responses
- Without `s3Adapter`, S3 exceptions would fall through to the generic 500 handler
- The success response shape (`{ success, data, message }`) is identical whether using disk or S3