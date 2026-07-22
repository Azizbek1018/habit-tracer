// Payme Merchant API bilan ishlash uchun yordamchi funksiyalar va xatolik kodlari
// Hujjat: Payme har bir so'rovda "Authorization: Basic base64(Paycom:MERCHANT_KEY)" header yuboradi

// Payme so'rovi haqiqiy Payme'dan kelayotganini tekshirish
function verifyPaymeAuth(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [login, key] = credentials.split(":");

  return login === "Paycom" && key === process.env.PAYME_KEY;
}

// Payme JSON-RPC standart xatolik kodlari
const PAYME_ERRORS = {
  INVALID_AMOUNT: { code: -31001, message: { uz: "Noto'g'ri summa", ru: "Неверная сумма", en: "Invalid amount" } },
  TRANSACTION_NOT_FOUND: { code: -31003, message: { uz: "Tranzaksiya topilmadi", ru: "Транзакция не найдена", en: "Transaction not found" } },
  CANNOT_CANCEL: { code: -31007, message: { uz: "Tranzaksiyani bekor qilib bo'lmaydi", ru: "Невозможно отменить транзакцию", en: "Cannot cancel transaction" } },
  ORDER_NOT_FOUND: { code: -31050, message: { uz: "Buyurtma (foydalanuvchi/reja) topilmadi", ru: "Заказ не найден", en: "Order not found" } },
  AUTH_FAILED: { code: -32504, message: { uz: "Ruxsat yo'q", ru: "Недостаточно прав", en: "Insufficient privilege" } },
};

// Standart JSON-RPC xatolik javobini shakllantirish
function paymeErrorResponse(id, error) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code: error.code, message: error.message },
  };
}

module.exports = { verifyPaymeAuth, PAYME_ERRORS, paymeErrorResponse };
