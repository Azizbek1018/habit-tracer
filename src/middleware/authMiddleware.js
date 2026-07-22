// Himoyalangan route'larga faqat tizimga kirgan foydalanuvchilar kirishi uchun middleware

const { verifyToken } = require("../utils/jwt");

function authMiddleware(req, res, next) {
  // Token odatda "Authorization: Bearer <token>" formatida keladi
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token topilmadi. Iltimos, tizimga kiring." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    // Tekshirilgan foydalanuvchi ID'sini keyingi controller'lar uchun req ichiga qo'yamiz
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token yaroqsiz yoki muddati o'tgan." });
  }
}

module.exports = authMiddleware;
