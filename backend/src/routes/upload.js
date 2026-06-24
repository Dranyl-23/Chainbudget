const express = require("express");
const router = express.Router();
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { authenticate } = require("../middleware/auth");

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage — keep file in memory for hashing, then write to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP images and PDFs are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

/// POST /api/upload — Upload a receipt or document
router.post("/", authenticate, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Compute SHA-256 hash of the file buffer
    const hash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    // Build a safe filename: timestamp + hash prefix + original extension
    const ext = path.extname(req.file.originalname).toLowerCase() || ".bin";
    const safeFilename = `${Date.now()}-${hash.slice(0, 12)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    // Write the buffer to disk
    fs.writeFileSync(filePath, req.file.buffer);

    // Return public URL and hash
    const documentUrl = `/uploads/${safeFilename}`;
    res.status(201).json({
      documentUrl,
      documentHash: hash,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Failed to process file upload" });
  }
});

module.exports = router;
