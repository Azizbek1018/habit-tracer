// Ro'yxatdan o'tish va tizimga kirish bilan bog'liq logika

const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const { generateToken } = require("../utils/jwt");
const { SUPPORTED_LANGUAGES } = require("./userController");

// POST /api/auth/register
// Yangi foydalanuvchi ro'yxatdan o'tkazish.
// Onboarding oqimida foydalanuvchi avval tilni tanlaydi, shuning uchun
// `preferred_language` ixtiyoriy parametr sifatida qabul qilinadi (default: 'uz').
async function register(req, res) {
  try {
    const { username, email, password, preferred_language } = req.body;

    // Oddiy validatsiya
    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email va password majburiy." });
    }

    if (preferred_language && !SUPPORTED_LANGUAGES.includes(preferred_language)) {
      return res.status(400).json({ error: `preferred_language faqat quyidagilardan biri bo'lishi kerak: ${SUPPORTED_LANGUAGES.join(", ")}` });
    }

    // Email yoki username avval band qilinganmi, tekshiramiz
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Bu email yoki username allaqachon band." });
    }

    // Parolni xavfsiz saqlash uchun hash qilamiz
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { username, email, password_hash, preferred_language: preferred_language || "uz" },
      select: { id: true, username: true, email: true, preferred_language: true, created_at: true }, // parolni qaytarmaymiz
    });

    // Ro'yxatdan o'tgandan so'ng darhol token beramiz
    const token = generateToken(newUser.id);

    return res.status(201).json({ user: newUser, token });
  } catch (error) {
    console.error("Register xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

// POST /api/auth/login
// Mavjud foydalanuvchini tizimga kiritish
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email va password majburiy." });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Email yoki parol noto'g'ri." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email yoki parol noto'g'ri." });
    }

    const token = generateToken(user.id);

    return res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  } catch (error) {
    console.error("Login xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

module.exports = { register, login };
