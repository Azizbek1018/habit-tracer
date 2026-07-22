// Click Merchant API bilan ishlash uchun yordamchi funksiyalar
// Hujjat: Click har bir so'rovda "sign_string" yuboradi, biz uni MD5 orqali qayta hisoblab tekshiramiz

const crypto = require("crypto");

// Click "Prepare" (action=0) so'rovi uchun imzoni tekshirish
// sign_string = MD5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
function verifyClickPrepareSign({ click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, sign_string }) {
  const raw = `${click_trans_id}${service_id}${process.env.CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`;
  const expectedSign = crypto.createHash("md5").update(raw).digest("hex");
  return expectedSign === sign_string;
}

// Click "Complete" (action=1) so'rovi uchun imzoni tekshirish
// sign_string = MD5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
function verifyClickCompleteSign({ click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_time, sign_string }) {
  const raw = `${click_trans_id}${service_id}${process.env.CLICK_SECRET_KEY}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`;
  const expectedSign = crypto.createHash("md5").update(raw).digest("hex");
  return expectedSign === sign_string;
}

// Click xatolik kodlari (error maydoni uchun; 0 - xato yo'q)
const CLICK_ERRORS = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  TRANSACTION_NOT_FOUND: -3,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_ALREADY_CANCELLED: -9,
};

module.exports = { verifyClickPrepareSign, verifyClickCompleteSign, CLICK_ERRORS };
