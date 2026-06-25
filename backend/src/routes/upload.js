const express = require("express");
const router = express.Router();
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
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

/// POST /api/upload — Upload a receipt or document to IPFS via Pinata
router.post("/", authenticate, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const pinataJWT = process.env.PINATA_JWT;
    if (!pinataJWT) {
      return res.status(500).json({ error: "Pinata JWT not configured" });
    }

    // Build FormData to send to Pinata
    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const pinataMetadata = JSON.stringify({
      name: `ChainBudget_Receipt_${Date.now()}_${req.file.originalname}`,
    });
    formData.append("pinataMetadata", pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 1,
    });
    formData.append("pinataOptions", pinataOptions);

    // Upload to Pinata
    const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
      maxBodyLength: "Infinity",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
        Authorization: `Bearer ${pinataJWT}`,
      },
    });

    const ipfsHash = response.data.IpfsHash;
    const documentUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    // Return public URL and hash
    res.status(201).json({
      documentUrl,
      documentHash: ipfsHash,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
  } catch (err) {
    console.error("Error uploading to IPFS:", err?.response?.data || err.message);
    res.status(500).json({ error: "Failed to upload to IPFS" });
  }
});

module.exports = router;
