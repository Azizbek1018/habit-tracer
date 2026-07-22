// JWT token bilan ishlash uchun yordamchi funksiyalar

const jwt = require("jsonwebtoken");

// Foydalanuvchi uchun yangi token generatsiya qilish
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Tokenni tekshirish (verify) va ichidagi ma'lumotni qaytarish
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
