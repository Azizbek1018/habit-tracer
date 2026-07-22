// Free tarifdagi foydalanuvchilar uchun odatlar sonini cheklovchi middleware.
// authMiddleware'dan KEYIN ishlatiladi (req.userId kerak bo'ladi).
// Faqat POST /api/habits (yangi odat yaratish) uchun ishlatiladi.

const prisma = require("../config/db");

const FREE_TIER_HABIT_LIMIT = 3;

async function habitLimitMiddleware(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    if (!user) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    }

    // Agar obuna 'pro' bo'lsa lekin muddati o'tib ketgan bo'lsa - 'free' sifatida ko'ramiz
    const isProActive =
      user.subscription_tier === "pro" &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) >= new Date();

    // PRO foydalanuvchilar uchun cheklov yo'q
    if (isProActive) {
      return next();
    }

    const habitCount = await prisma.habit.count({ where: { user_id: req.userId } });

    if (habitCount >= FREE_TIER_HABIT_LIMIT) {
      return res.status(403).json({
        error: "Free tarifda maksimal 3 ta odat yaratish mumkin. Davom etish uchun PRO obunaga o'ting.",
        upgrade_required: true,
      });
    }

    next();
  } catch (error) {
    console.error("Habit limitini tekshirish xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

module.exports = habitLimitMiddleware;
