// /api/habits prefiksi bilan ishlaydigan route'lar
// Barcha route'lar himoyalangan - authMiddleware orqali o'tadi

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const habitLimitMiddleware = require("../middleware/habitLimitMiddleware");
const { createHabit, getHabits, checkHabit } = require("../controllers/habitController");

// Odat yaratishdan oldin: 1) tizimga kirganmi (authMiddleware), 2) free-limitga tegmaganmi (habitLimitMiddleware)
router.post("/", authMiddleware, habitLimitMiddleware, createHabit);
router.get("/", authMiddleware, getHabits);
router.post("/:id/check", authMiddleware, checkHabit);

module.exports = router;
