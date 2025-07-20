const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);

  // Настрой SMTP (здесь Gmail — можно заменить на Brevo или др.)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "your_email@gmail.com", // заменишь
      pass: "your_app_password",    // не пароль, а App Password
    },
  });

  const mailOptions = {
    from: '"OTP Sender" <your_email@gmail.com>',
    to: email,
    subject: "Ваш OTP-код",
    text: `Ваш код: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Код отправлен!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Ошибка отправки" });
  }
});

app.get("/", (req, res) => res.send("Сервер работает"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Сервер запущен на порту", PORT));