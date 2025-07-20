const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Память для хранения кодов: email => { code, expiresAt }
const otpStore = new Map();

// Генерация кода
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000);
}

// Очистка кода через 5 минут
function storeOtp(email, code) {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут
  otpStore.set(email, { code, expiresAt });

  setTimeout(() => {
    const current = otpStore.get(email);
    if (current && current.expiresAt <= Date.now()) {
      otpStore.delete(email);
      console.log(`Код для ${email} удалён (просрочен)`);
    }
  }, 5 * 60 * 1000);
}

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
    from: `"OTP Сервис" <${process.env.EMAIL_USER}>`,
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

app.post("/verify-otp", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, message: "Email и код обязательны" });

  const stored = otpStore.get(email);
  if (!stored) {
    return res.status(400).json({ success: false, message: "Код не найден или истёк" });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: "Срок действия кода истёк" });
  }

  if (parseInt(code) === stored.code) {
    otpStore.delete(email);
    return res.json({ success: true, message: "Код подтверждён" });
  } else {
    return res.status(400).json({ success: false, message: "Неверный код" });
  }
});

app.get("/", (req, res) => {
  res.send("OTP сервер работает");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Сервер запущен на порту", PORT));