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
        throw new Error("Pinata JWT not configured");
      }

      // Build FormData to send to Pinata
      const formData = new FormData();
      formData.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const pinataMetadata = JSON.stringify({
        name: `ChainBudget_Upload_${Date.now()}_${req.file.originalname}`,
      });
      formData.append("pinataMetadata", pinataMetadata);

      const pinataOptions = JSON.stringify({
        cidVersion: 1,
      });
      formData.append("pinataOptions", pinataOptions);

      // Upload to Pinata
      const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${pinataJWT}`,
        },
      });

      const ipfsHash = response.data.IpfsHash;
      const documentUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

      // Return public URL and hash
      return res.status(201).json({
        documentUrl,
        documentHash: ipfsHash,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
    } catch (err) {
      console.warn("Pinata IPFS upload failed, falling back to local storage:", err?.response?.data || err.message);
      
      // Only write to local disk as a last-resort fallback
      const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      const localFilename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeName}`;
      const localFilePath = path.join(UPLOADS_DIR, localFilename);
      fs.writeFileSync(localFilePath, req.file.buffer);
      const localUrl = `${req.protocol}://${req.get("host")}/uploads/${localFilename}`;

      // Return local URL as fallback with explicit warning
      return res.status(201).json({
        documentUrl: localUrl,
        documentHash: "local_" + crypto.randomBytes(8).toString("hex"),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        isLocal: true,
        warning: "File stored locally. It may be lost on server restart. Configure PINATA_JWT for persistent IPFS storage."
      });
    }
});

module.exports = router;
