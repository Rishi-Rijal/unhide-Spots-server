import AsyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import "dotenv/config";
import sendEmail from "../utils/sendEmail.js";

const sendContactMessage = AsyncHandler(async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    throw new ApiError(400, "name, email and message are required");
  }

  const recipient = process.env.CONTACT_EMAIL_TO || process.env.DEFAULT_EMAIL_TO;

  const subject = `Contact message from ${name}`;
  const text = `You received a contact message:\n\nFrom: ${name} <${email}>\n\nMessage:\n${message}`;
  const html = `
    <p>You received a contact message:</p>
    <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
    <p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
  `;

  await sendEmail(recipient, subject, text, html);

  return res.status(200).json({ success: true, message: 'Contact message sent' });
});

export { sendContactMessage };
