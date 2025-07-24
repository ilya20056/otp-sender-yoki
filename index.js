// index.js — Готовый сервер с OTP + Firestore-подобной JSON-базой + API для Android

const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const db = require("./yoki_database/firestore");
const app = express();

app.use(cors());
app.use(express.json());

// OTP Store: email => { code, expiresAt }
const otpStore = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000);
}

function storeOtp(email, code) {
  const expiresAt = Date.now() + 5 * 60 * 1000;
  otpStore.set(email, { code, expiresAt });

  setTimeout(() => {
    const current = otpStore.get(email);
    if (current && current.expiresAt <= Date.now()) {
      otpStore.delete(email);
      console.log(`Код для ${email} удалён (просрочен)`);
    }
  }, 5 * 60 * 1000);
}

// ✅ SEND OTP
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email обязателен" });

  const otp = generateOtp();
  storeOtp(email, otp);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `\"OTP Сервис\" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Ваш OTP-код",
    text: `Ваш код подтверждения: ${otp}. Он действует 5 минут.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Код отправлен на почту" });
    console.log(`OTP отправлен ${email}: ${otp}`);
  } catch (error) {
    console.error("Ошибка при отправке:", error);
    res.status(500).json({ success: false, message: "Ошибка отправки письма" });
  }
});

// ✅ VERIFY OTP
app.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, message: "Email и код обязательны" });

  const stored = otpStore.get(email);
  if (!stored) return res.status(400).json({ success: false, message: "Код не найден или истёк" });

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: "Срок действия кода истёк" });
  }

  if (parseInt(code) === stored.code) {
    otpStore.delete(email);
    await db.collection("users").doc(email).set({ email, verifiedAt: Date.now() });
    return res.json({ success: true, message: "Код подтверждён" });
  } else {
    return res.status(400).json({ success: false, message: "Неверный код" });
  }
});

// ✅ Firestore-подобные API

// set или update документа
app.post("/db/:collection/:docId", async (req, res) => {
  await db.collection(req.params.collection).doc(req.params.docId).set(req.body);
  res.json({ success: true });
});

// получить один документ
app.get("/db/:collection/:docId", async (req, res) => {
  const doc = await db.collection(req.params.collection).doc(req.params.docId).get();
  if (!doc.exists) return res.status(404).json({ success: false });
  res.json({ id: req.params.docId, ...doc.data() });
});

// получить все документы коллекции
app.get("/db/:collection", async (req, res) => {
  const docs = await db.collection(req.params.collection).get();
  res.json(docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

// фильтрация по where, orderBy, limit (GET /query/users?...)
app.get("/query/:collection", async (req, res) => {
  let col = db.collection(req.params.collection);

  if (req.query.where) {
    const [field, op, value] = req.query.where.split(",");
    col = col.where(field, op, parseValue(value));
  }
  if (req.query.orderBy) {
    const [field, dir] = req.query.orderBy.split(",");
    col = col.orderBy(field, dir);
  }
  if (req.query.limit) {
    col = col.limit(parseInt(req.query.limit));
  }

  const docs = await col.get();
  res.json(docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

function parseValue(val) {
  if (!isNaN(val)) return Number(val);
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}

// тест
app.get("/", (req, res) => {
  res.send("OTP Firestore JSON Server работает ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Сервер запущен на порту", PORT));