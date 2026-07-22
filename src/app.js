// Express ilovasini sozlash (middleware'lar va route'larni ulash)

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const habitRoutes = require("./routes/habitRoutes");
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// Global middleware'lar
app.use(cors());
app.use(express.json()); // JSON body'larni o'qish uchun

// Health-check endpoint (server ishlab turganini tekshirish uchun)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server ishlab turibdi." });
});

// Route'larni ulash
app.use("/api/auth", authRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);

// 404 - topilmagan route'lar uchun
app.use((req, res) => {
  res.status(404).json({ error: "So'ralgan endpoint topilmadi." });
});

// Umumiy xatoliklarni ushlab olish (error handler)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Kutilmagan server xatosi." });
});

module.exports = app;
