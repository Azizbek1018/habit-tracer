// Foydalanuvchi profili va onboarding (til tanlash) bilan bog'liq logika

const prisma = require("../config/db");

const SUPPORTED_LANGUAGES = ["uz", "ru", "en"];

// GET /api/users/me
// Joriy foydalanuvchining profili, tili va obuna holatini qaytaradi.
// Frontend shu endpoint orqali "onboarding kerakmi?" degan savolga javob topadi:
// agar preferred_language hali tanlanmagan bo'lsa (bu yerda har doim default 'uz' bo'ladi,
// shuning uchun onboarding holatini frontend localStorage/flag orqali kuzatishi tavsiya etiladi,
// yoki quyidagi has_completed_onboarding kabi maydonni keyinchalik User modeliga qo'shish mumkin).
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        email: true,
        preferred_language: true,
        subscription_tier: true,
        subscription_expires_at: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    }

    // PRO muddati o'tib ketgan bo'lsa, javobda buni frontendga aniq ko'rsatamiz
    // (haqiqiy DB yangilanishi background job yoki keyingi so'rovda amalga oshadi)
    const isProActive =
      user.subscription_tier === "pro" &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) >= new Date();

    return res.status(200).json({ user, is_pro_active: Boolean(isProActive) });
  } catch (error) {
    console.error("Profilni olish xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

// PATCH /api/users/language
// Onboarding oqimida foydalanuvchi birinchi marta tilni tanlaganda chaqiriladi
// (keyinchalik sozlamalardan tilni o'zgartirish uchun ham ishlatiladi)
async function setPreferredLanguage(req, res) {
  try {
    const { language } = req.body;

    if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: `language faqat quyidagilardan biri bo'lishi kerak: ${SUPPORTED_LANGUAGES.join(", ")}` });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { preferred_language: language },
      select: { id: true, username: true, preferred_language: true },
    });

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Tilni o'rnatish xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

module.exports = { getMe, setPreferredLanguage, SUPPORTED_LANGUAGES };
