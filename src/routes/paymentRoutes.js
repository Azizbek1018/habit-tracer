// /api/payments prefiksi bilan ishlaydigan route'lar

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  checkout,
  handlePaymeWebhook,
  handleClickWebhook,
  handleStripeWebhook,
} = require("../controllers/paymentController");

// Foydalanuvchi PRO obunaga o'tish uchun to'lovni boshlaydi (tizimga kirgan bo'lishi kerak)
router.post("/checkout", authMiddleware, checkout);

// Webhook'lar - bular provayderlarning o'zidan keladi, shuning uchun authMiddleware YO'Q.
// Xavfsizlik provayderga xos imzo/auth tekshiruvi orqali (paymeUtils/clickUtils) ta'minlanadi.
router.post("/webhook/payme", handlePaymeWebhook);
router.post("/webhook/click", handleClickWebhook);
router.post("/webhook/stripe", handleStripeWebhook);

module.exports = router;
