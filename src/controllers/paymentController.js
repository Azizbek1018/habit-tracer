// To'lovni boshlash (checkout) va Click/Payme/Stripe'dan keladigan webhook'larni qayta ishlash.
// Obuna holati alohida jadvalda emas, to'g'ridan-to'g'ri User.subscription_tier va
// User.subscription_expires_at maydonlarida saqlanadi (soddalashtirilgan SaaS modeli).

const prisma = require("../config/db");
const { verifyPaymeAuth, PAYME_ERRORS, paymeErrorResponse } = require("../utils/paymeUtils");
const { verifyClickPrepareSign, verifyClickCompleteSign, CLICK_ERRORS } = require("../utils/clickUtils");

// PRO tarif narxi va muddati (so'mda / kunda) - .env orqali sozlanadi
const PRO_PLAN_PRICE = Number(process.env.PRO_PLAN_PRICE || 49000);
const PRO_PLAN_DURATION_DAYS = Number(process.env.PRO_PLAN_DURATION_DAYS || 30);

// =====================================================
// 1. TO'LOVNI BOSHLASH
// =====================================================

// POST /api/payments/checkout
// Foydalanuvchi PRO obunaga o'tish uchun to'lov jarayonini boshlaydi.
// Body: { provider: "click" | "payme" | "stripe" }
async function checkout(req, res) {
  try {
    const userId = req.userId;
    const { provider } = req.body;

    if (!provider || !["click", "payme", "stripe"].includes(provider)) {
      return res.status(400).json({ error: "provider 'click', 'payme' yoki 'stripe' bo'lishi kerak." });
    }

    // "pending" holatda yangi to'lov yozuvi - webhook kelganda shu orqali topamiz
    const payment = await prisma.payment.create({
      data: { user_id: userId, provider, amount: PRO_PLAN_PRICE, status: "pending" },
    });

    let checkout_url;

    if (provider === "payme") {
      // Payme checkout: https://checkout.paycom.uz/{base64(params)}
      // "ac.payment_id" - Payme tomonidan hisob (account) parametri sifatida qaytariladi
      const params = `m=${process.env.PAYME_MERCHANT_ID};ac.payment_id=${payment.id};a=${Math.round(PRO_PLAN_PRICE * 100)}`;
      checkout_url = `https://checkout.paycom.uz/${Buffer.from(params).toString("base64")}`;
    } else if (provider === "click") {
      // Click checkout: merchant_trans_id sifatida payment.id yuboriladi
      checkout_url = `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${PRO_PLAN_PRICE}&transaction_param=${payment.id}`;
    } else {
      // Stripe: real integratsiyada bu yerda 'stripe' SDK orqali Checkout Session yaratiladi
      // (client_reference_id = payment.id). Hozircha havola formati ko'rsatilgan.
      checkout_url = `https://checkout.stripe.com/pay/placeholder?client_reference_id=${payment.id}`;
    }

    return res.status(201).json({ payment_id: payment.id, provider, amount: PRO_PLAN_PRICE, checkout_url });
  } catch (error) {
    console.error("Checkout xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

// To'lov muvaffaqiyatli bo'lganda: foydalanuvchini PRO'ga o'tkazish
// Agar hozirgi obuna hali tugamagan bo'lsa, muddatga ustiga qo'shib boramiz (uzaytirish);
// aks holda bugundan boshlab hisoblaymiz.
async function upgradeUserToPro(userId, durationDays) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const currentExpiry = user.subscription_expires_at;
  const base = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date();
  base.setDate(base.getDate() + durationDays);

  await prisma.user.update({
    where: { id: userId },
    data: { subscription_tier: "pro", subscription_expires_at: base },
  });
}

// =====================================================
// 2. PAYME WEBHOOK (JSON-RPC)
// POST /api/payments/webhook/payme
// =====================================================
async function handlePaymeWebhook(req, res) {
  const { method, params, id } = req.body;

  if (!verifyPaymeAuth(req)) {
    return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.AUTH_FAILED));
  }

  try {
    switch (method) {
      case "CheckPerformTransaction":
        return await paymeCheckPerform(params, id, res);
      case "CreateTransaction":
        return await paymeCreate(params, id, res);
      case "PerformTransaction":
        return await paymePerform(params, id, res);
      case "CancelTransaction":
        return await paymeCancel(params, id, res);
      case "CheckTransaction":
        return await paymeCheck(params, id, res);
      default:
        return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));
    }
  } catch (error) {
    console.error("Payme webhook xatosi:", error);
    return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));
  }
}

async function paymeCheckPerform(params, id, res) {
  const paymentId = parseInt(params.account.payment_id, 10);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.ORDER_NOT_FOUND));

  const expectedAmount = Math.round(Number(payment.amount) * 100); // Payme summani tiyinda kutadi
  if (params.amount !== expectedAmount) {
    return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.INVALID_AMOUNT));
  }

  return res.status(200).json({ jsonrpc: "2.0", id, result: { allow: true } });
}

async function paymeCreate(params, id, res) {
  const paymentId = parseInt(params.account.payment_id, 10);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.ORDER_NOT_FOUND));

  if (payment.transaction_id !== params.id) {
    await prisma.payment.update({ where: { id: paymentId }, data: { transaction_id: params.id } });
  }

  return res.status(200).json({
    jsonrpc: "2.0",
    id,
    result: { create_time: new Date(payment.created_at).getTime(), transaction: String(payment.id), state: 1 },
  });
}

async function paymePerform(params, id, res) {
  const payment = await prisma.payment.findFirst({ where: { transaction_id: params.id } });
  if (!payment) return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));

  if (payment.status !== "completed") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "completed" } });
    await upgradeUserToPro(payment.user_id, PRO_PLAN_DURATION_DAYS);
  }

  return res.status(200).json({
    jsonrpc: "2.0",
    id,
    result: { transaction: String(payment.id), perform_time: Date.now(), state: 2 },
  });
}

async function paymeCancel(params, id, res) {
  const payment = await prisma.payment.findFirst({ where: { transaction_id: params.id } });
  if (!payment) return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });

  return res.status(200).json({
    jsonrpc: "2.0",
    id,
    result: { transaction: String(payment.id), cancel_time: Date.now(), state: -1 },
  });
}

async function paymeCheck(params, id, res) {
  const payment = await prisma.payment.findFirst({ where: { transaction_id: params.id } });
  if (!payment) return res.status(200).json(paymeErrorResponse(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));

  const stateMap = { pending: 1, completed: 2, failed: -1 };

  return res.status(200).json({
    jsonrpc: "2.0",
    id,
    result: {
      create_time: new Date(payment.created_at).getTime(),
      perform_time: payment.status === "completed" ? new Date(payment.updated_at).getTime() : 0,
      cancel_time: payment.status === "failed" ? new Date(payment.updated_at).getTime() : 0,
      transaction: String(payment.id),
      state: stateMap[payment.status] ?? 1,
    },
  });
}

// =====================================================
// 3. CLICK WEBHOOK (bitta endpoint, action orqali Prepare/Complete ajratiladi)
// POST /api/payments/webhook/click
// =====================================================
async function handleClickWebhook(req, res) {
  const body = req.body;
  const action = Number(body.action);

  try {
    if (action === 0) return await clickPrepare(body, res);
    if (action === 1) return await clickComplete(body, res);
    return res.status(200).json({ error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Noma'lum action" });
  } catch (error) {
    console.error("Click webhook xatosi:", error);
    return res.status(200).json({ error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Server xatosi" });
  }
}

async function clickPrepare(body, res) {
  const { click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, sign_string } = body;

  if (!verifyClickPrepareSign({ click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, sign_string })) {
    return res.status(200).json({ error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Imzo mos kelmadi" });
  }

  const payment = await prisma.payment.findUnique({ where: { id: parseInt(merchant_trans_id, 10) } });
  if (!payment) return res.status(200).json({ error: CLICK_ERRORS.ORDER_NOT_FOUND, error_note: "To'lov topilmadi" });

  if (Math.round(Number(payment.amount)) !== Math.round(Number(amount))) {
    return res.status(200).json({ error: CLICK_ERRORS.INCORRECT_AMOUNT, error_note: "Summa mos kelmadi" });
  }

  await prisma.payment.update({ where: { id: payment.id }, data: { transaction_id: String(click_trans_id) } });

  return res.status(200).json({
    click_trans_id,
    merchant_trans_id,
    merchant_prepare_id: payment.id,
    error: CLICK_ERRORS.SUCCESS,
    error_note: "OK",
  });
}

async function clickComplete(body, res) {
  const { click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_time, sign_string, error } = body;

  if (!verifyClickCompleteSign({ click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_time, sign_string })) {
    return res.status(200).json({ error: CLICK_ERRORS.SIGN_CHECK_FAILED, error_note: "Imzo mos kelmadi" });
  }

  const payment = await prisma.payment.findUnique({ where: { id: parseInt(merchant_trans_id, 10) } });
  if (!payment) return res.status(200).json({ error: CLICK_ERRORS.ORDER_NOT_FOUND, error_note: "To'lov topilmadi" });

  if (Number(error) < 0) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
  } else if (payment.status !== "completed") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "completed" } });
    await upgradeUserToPro(payment.user_id, PRO_PLAN_DURATION_DAYS);
  }

  return res.status(200).json({
    click_trans_id,
    merchant_trans_id,
    merchant_confirm_id: payment.id,
    error: CLICK_ERRORS.SUCCESS,
    error_note: "OK",
  });
}

// =====================================================
// 4. STRIPE WEBHOOK
// POST /api/payments/webhook/stripe
// Eslatma: productionda rasmiy 'stripe' npm paketi va uning
// `stripe.webhooks.constructEvent(rawBody, signature, secret)` funksiyasidan
// foydalanish tavsiya etiladi (imzoni to'g'ri tekshirish uchun raw body kerak).
// =====================================================
async function handleStripeWebhook(req, res) {
  try {
    const event = req.body;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentId = parseInt(session.client_reference_id, 10);

      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        return res.status(404).json({ error: "To'lov topilmadi." });
      }

      if (payment.status !== "completed") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "completed", transaction_id: session.id },
        });
        await upgradeUserToPro(payment.user_id, PRO_PLAN_DURATION_DAYS);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook xatosi:", error);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
}

module.exports = { checkout, handlePaymeWebhook, handleClickWebhook, handleStripeWebhook };
