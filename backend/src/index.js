require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const orgRoutes = require("./routes/organizations");
const userRoutes = require("./routes/users");
const transactionRoutes = require("./routes/transactions");
const approvalRoutes = require("./routes/approvals");
const reportRoutes = require("./routes/reports");
const auditRoutes = require("./routes/audit");
const budgetRoutes = require("./routes/budget");
const uploadRoutes = require("./routes/upload");
const adminRoutes = require("./routes/admin");
const daoRoutes = require("./routes/dao");
const publicRoutes = require("./routes/public");
const notificationRoutes = require("./routes/notifications");
const { generalRateLimiter, csrfProtection } = require("./middleware/security");

const app = express();
// Enable trust proxy so rate limiter works behind Render's load balancer
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// ── WebSocket Server ──────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
app.set("io", io);

io.on("connection", (socket) => {
  console.log("Client connected via WebSocket:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(morgan("dev"));

// ── Static file serving for uploaded receipts ─────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── Security Middleware ───────────────────────────────────────────────────────
// Apply general rate limiting to all API routes
app.use("/api/", generalRateLimiter);

// Apply CSRF protection to all POST/PUT/DELETE requests (except auth endpoints)
app.use("/api/", csrfProtection);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/organizations", orgRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dao", daoRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/notifications", notificationRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ── Database & server start ───────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    server.listen(PORT, () => {
      console.log(`ChainBudget API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

module.exports = app;
