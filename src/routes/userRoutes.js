// /api/users prefiksi bilan ishlaydigan route'lar

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getMe, setPreferredLanguage } = require("../controllers/userController");

router.get("/me", authMiddleware, getMe);
router.patch("/language", authMiddleware, setPreferredLanguage);

module.exports = router;
