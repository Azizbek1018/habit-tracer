// Prisma Client'ni butun loyiha bo'ylab bitta instance sifatida ishlatish uchun
// (har safar yangi PrismaClient yaratish tavsiya etilmaydi)

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
