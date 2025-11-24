import AsyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import nodemailer from "nodemailer";

const sendContactMessage = AsyncHandler(async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    throw new ApiError(400, "name, email and message are required");
  }

  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const recipient = "rishirijal2025@gmail.com";

  const subject = `Contact message from ${name}`;
  const text = `You received a contact message:\n\nFrom: ${name} <${email}>\n\nMessage:\n${message}`;
  const html = `
    <p>You received a contact message:</p>
    <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
    <p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
  `;

  await transporter.sendMail({
    from: `${'Unhide Nepal'} <${process.env.SMTP_EMAIL}>`,
    to: recipient,
    subject,
    text,
    html,
  });

  return res.status(200).json({ success: true, message: 'Contact message sent' });
});

export { sendContactMessage };
