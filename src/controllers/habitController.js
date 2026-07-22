// Odatlar (Habits) bilan bog'liq CRUD va "check" logikasi

const prisma = require("../config/db");

// POST /api/habits
// Yangi odat qo'shish (faqat tizimga kirgan foydalanuvchi uchun)
async function createHabit(req, res) {
  try {
    const { title, description, frequency } = req.body;
    const userId = req.userId; // authMiddleware orqali keladi

    if (!title) {
      return res.status(400).json({ error: "title (odat nomi) majburiy." });
    }

    // frequency faqat "daily" yoki "weekly" bo'lishi kerak
    if (frequency && !["daily", "weekly"].includes(frequency)) {
      return res.status(400).json({ error: "frequency faqat 'daily' yoki 'weekly' bo'lishi mumkin." });
    }

    const habit = await prisma.habit.create({
      data: {
        user_id: userId,
        title,
        description,
        frequency: frequency || "daily",
      },
    });

    return res.status(201).json({ habit });
  } catch (error) {
    console.error("Odat yaratish xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

// GET /api/habits
// Tizimga kirgan foydalanuvchining barcha odatlarini olish
async function getHabits(req, res) {
  try {
    const userId = req.userId;

    const habits = await prisma.habit.findMany({
      where: { user_id: userId },
      include: {
        logs: {
          orderBy: { date: "desc" },
          take: 7, // oxirgi 7 kunlik logni ko'rsatish (streak hisoblash uchun ham foydali)
        },
      },
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json({ habits });
  } catch (error) {
    console.error("Odatlarni olish xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

// POST /api/habits/:id/check
// Bugungi kun uchun odatni "bajarildi" deb belgilash
async function checkHabit(req, res) {
  try {
    const userId = req.userId;
    const habitId = parseInt(req.params.id, 10);
    const { status } = req.body; // "completed" yoki "skipped", default: completed

    // Odat mavjudligini va aynan shu foydalanuvchiga tegishli ekanligini tekshiramiz
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, user_id: userId },
    });

    if (!habit) {
      return res.status(404).json({ error: "Odat topilmadi." });
    }

    // Bugungi sanani vaqtsiz (faqat kun) saqlaymiz, bir kunga bir log bo'lishi uchun
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Agar bugun uchun log allaqachon mavjud bo'lsa - yangilaymiz, aks holda yaratamiz
    const log = await prisma.habitLog.upsert({
      where: {
        habit_id_date: {
          habit_id: habitId,
          date: today,
        },
      },
      update: {
        status: status || "completed",
      },
      create: {
        habit_id: habitId,
        date: today,
        status: status || "completed",
      },
    });

    return res.status(200).json({ message: "Odat holati yangilandi.", log });
  } catch (error) {
    console.error("Odatni belgilash xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

module.exports = { createHabit, getHabits, checkHabit };
