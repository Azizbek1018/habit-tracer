# Habit Tracker & Challenges — Backend (SaaS MVP)

Node.js + Express + PostgreSQL (Prisma ORM) asosida qurilgan backend.

## Ishga tushirish

1. **Kutubxonalarni o'rnatish:**
   ```bash
   npm install
   ```

2. **`.env` faylini yaratish:**
   `.env.example`'ni nusxalab, `.env` deb saqlang va `DATABASE_URL`, `JWT_SECRET` qiymatlarini o'zingizga moslang:
   ```bash
   cp .env.example .env
   ```

3. **Ma'lumotlar bazasini migratsiya qilish:**
   ```bash
   npm run prisma:migrate
   ```
   (Bu buyruq PostgreSQL'da jadvallarni yaratadi va Prisma Client'ni generatsiya qiladi.)

4. **Serverni ishga tushirish (dev rejimida, avtomatik qayta yuklanish bilan):**
   ```bash
   npm run dev
   ```
   Yoki production uchun:
   ```bash
   npm start
   ```

Server default holda `http://localhost:5000` manzilida ishlaydi.

## Mavjud API endpoint'lari

| Metod | Yo'l | Himoyalangan? | Tavsif |
|---|---|---|---|
| GET | `/api/health` | Yo'q | Server holatini tekshirish |
| POST | `/api/auth/register` | Yo'q | Yangi foydalanuvchi ro'yxatdan o'tishi |
| POST | `/api/auth/login` | Yo'q | Tizimga kirish |
| POST | `/api/habits` | Ha (Bearer token) | Yangi odat qo'shish |
| GET | `/api/habits` | Ha (Bearer token) | Foydalanuvchining odatlar ro'yxati |
| POST | `/api/habits/:id/check` | Ha (Bearer token) | Bugungi odatni bajarildi/o'tkazib yuborildi deb belgilash (**free tarifda 3 ta odat limiti bor**) |
| GET | `/api/users/me` | Ha (Bearer token) | Profil, til va obuna holati |
| PATCH | `/api/users/language` | Ha (Bearer token) | Interfeys tilini o'rnatish/o'zgartirish (`uz`/`ru`/`en`) |
| POST | `/api/payments/checkout` | Ha (Bearer token) | PRO (Dark Elite) obunaga o'tish uchun to'lovni boshlash |
| POST | `/api/payments/webhook/payme` | Yo'q (Payme auth) | Payme JSON-RPC webhook |
| POST | `/api/payments/webhook/click` | Yo'q (Click imzo) | Click webhook (Prepare/Complete) |
| POST | `/api/payments/webhook/stripe` | Yo'q (Stripe imzo) | Stripe webhook |

### Autentifikatsiya

`register` yoki `login` dan qaytgan `token`ni keyingi so'rovlarda quyidagicha yuborish kerak:

```
Authorization: Bearer <token>
```

### Misol so'rovlar

**Ro'yxatdan o'tish:**
```json
POST /api/auth/register
{
  "username": "aziz",
  "email": "aziz@example.com",
  "password": "parol123"
}
```

**Odat qo'shish:**
```json
POST /api/habits
Headers: Authorization: Bearer <token>
{
  "title": "Kitob o'qish",
  "description": "Har kuni 20 sahifa",
  "frequency": "daily"
}
```

**Bugungi odatni belgilash:**
```json
POST /api/habits/1/check
Headers: Authorization: Bearer <token>
{
  "status": "completed"
}
```

## Til (i18n) va Onboarding

- Foydalanuvchi birinchi marta kirganda frontend tilni tanlash ekranini ko'rsatadi (`uz`/`ru`/`en`).
- Tanlangan til `POST /api/auth/register`'da `preferred_language` sifatida yuborilishi mumkin, yoki keyinroq `PATCH /api/users/language` orqali o'zgartiriladi.
- `locales/uz.json`, `locales/ru.json`, `locales/en.json` — frontend va backend uchun umumiy tarjima manbai (onboarding, auth, habits, eslatmalar, obuna matnlari).
- `src/utils/notificationMessages.js` — Telegram/Push eslatmalarni foydalanuvchi tilida, "dark stoic" uslubida shakllantiradi:
  ```js
  const { getNotificationText } = require("./src/utils/notificationMessages");
  getNotificationText("ru", "notifications.streak_milestone", { count: 7 });
  // -> "Серия из 7 дней. Это не случайность — это результат дисциплины."
  ```
  Bu funksiya matnni tayyorlaydi; haqiqiy Telegram bot orqali yuborish uchun `node-telegram-bot-api` kabi kutubxona bilan alohida integratsiya kerak bo'ladi.

## SaaS tariflar (Free vs Dark Elite/PRO)

| | Free | Dark Elite (PRO) |
|---|---|---|
| Odatlar soni | Maksimal 3 ta | Cheksiz |
| Chellenj | 1 oylik | 2 oylik premium |
| Jamoaviy guruhlar | — | Bor |
| Streak Freeze | — | Bor |
| Chuqur tahlil | — | Bor |

- Cheklov `src/middleware/habitLimitMiddleware.js` orqali amalga oshiriladi: `free` foydalanuvchi 4-odatni qo'shmoqchi bo'lsa, `403 Forbidden` va `"PRO obunaga o'ting"` xabari qaytadi.
- Obuna holati alohida jadvalda emas, `User.subscription_tier` (`free`/`pro`) va `User.subscription_expires_at` maydonlarida saqlanadi — soddaligi uchun.
- `subscription_expires_at` muddati o'tgan `pro` foydalanuvchi middleware tomonidan avtomatik `free` sifatida ko'riladi (DB'dagi yozuv keyingi to'lov/tekshiruvda yangilanadi).

### To'lov oqimi (Payme / Click / Stripe)

1. Frontend `POST /api/payments/checkout` ga `{ "provider": "click" | "payme" | "stripe" }` yuboradi.
2. Backend `pending` holatda `Payment` yozuvi yaratadi va provayderga mos `checkout_url` qaytaradi.
3. Foydalanuvchi to'lovni provayder sahifasida yakunlaydi.
4. Provayder mos webhook'ga (`/api/payments/webhook/payme|click|stripe`) so'rov yuboradi.
5. Webhook to'lovni tasdiqlasa: `Payment.status = "completed"` va `User.subscription_tier = "pro"`, `subscription_expires_at` esa **joriy muddat tugamagan bo'lsa — ustiga, aks holda bugundan** +30 kunga (`PRO_PLAN_DURATION_DAYS`) o'rnatiladi.

**Muhim eslatma:** Payme va Click uchun imzo/auth tekshiruvi (`src/utils/paymeUtils.js`, `src/utils/clickUtils.js`) rasmiy hujjatlarga asoslangan standart sxema bo'yicha yozilgan. Stripe uchun productionda rasmiy `stripe` npm paketi va `stripe.webhooks.constructEvent(...)` ishlatilishi tavsiya etiladi (hozirgi kod — soddalashtirilgan namuna). Har uchala provayder uchun ham haqiqiy merchant ma'lumotlari (`.env`) va sandbox muhitida test qilish talab etiladi.

## Keyingi qadamlar (hali qilinmagan)

- Challenge va ChallengeParticipant uchun endpoint'lar (qo'shilish, streak yangilanishi)
- Streak hisoblash logikasi (ketma-ket kunlarni tekshirish) va "Streak Freeze" (PRO) funksiyasi
- Haqiqiy Telegram bot integratsiyasi (eslatmalarni jadval bo'yicha yuborish, masalan `node-cron` + Telegram Bot API)
- Rasmiy `stripe` SDK bilan to'liq Stripe Checkout Session integratsiyasi
- Input validatsiyasini kuchaytirish (masalan, `zod` yoki `joi` bilan)
- Payme/Click/Stripe uchun sandbox muhitida end-to-end testlar
