// Telegram/Push eslatmalarini foydalanuvchining tanlagan tilida ("dark stoic" uslubida)
// shakllantirish uchun yordamchi. Matnlar /locales/*.json fayllaridan olinadi, shu tarzda
// backend va frontend bitta "manba"dan (locales) foydalanadi.

const path = require("path");

const locales = {
  uz: require(path.join(__dirname, "../../locales/uz.json")),
  ru: require(path.join(__dirname, "../../locales/ru.json")),
  en: require(path.join(__dirname, "../../locales/en.json")),
};

// key masalan: "notifications.reminder_daily" yoki "notifications.streak_milestone"
// params - {{count}} kabi o'zgaruvchilarni almashtirish uchun, masalan { count: 7 }
function getNotificationText(language, key, params = {}) {
  const lang = locales[language] ? language : "uz"; // noma'lum til bo'lsa - uz'ga tushamiz
  const dict = locales[lang];

  const value = key.split(".").reduce((acc, part) => acc?.[part], dict);

  if (!value) {
    return "";
  }

  // {{param}} shabloniga qiymatlarni joylashtiramiz
  return value.replace(/\{\{(\w+)\}\}/g, (_, paramName) => (params[paramName] !== undefined ? params[paramName] : `{{${paramName}}}`));
}

module.exports = { getNotificationText };
