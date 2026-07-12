const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  // Render's outbound network can't route to Gmail's IPv6 SMTP address,
  // which causes ENETUNREACH even though credentials are fine. Forcing
  // IPv4 (family: 4) makes Node resolve smtp.gmail.com to an IPv4 address
  // instead, which Render can reach.
  family: 6,
});

// Verify SMTP connection once on startup so misconfiguration is obvious immediately
transporter.verify((err) => {
  if (err) {
    console.error('SMTP connection failed:', err.message);
  } else {
    console.log('SMTP connection ready to send emails');
  }
});

const fromHeader = `"${process.env.MAIL_FROM_NAME || 'Portfolio'}" <${process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER}>`;

/**
 * Notify the site owner that a new contact message arrived.
 */
async function sendAdminNotification({ name, email, subject, message, id }) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: fromHeader,
    to,
    replyTo: email,
    subject: `New portfolio contact message: ${subject || 'No subject'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color:#111;">New contact form submission</h2>
        <table style="width:100%; border-collapse: collapse; font-size:14px;">
          <tr><td style="padding:6px 0; color:#666; width:110px;">Name</td><td style="padding:6px 0;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:6px 0; color:#666;">Email</td><td style="padding:6px 0;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:6px 0; color:#666;">Subject</td><td style="padding:6px 0;">${escapeHtml(subject || '-')}</td></tr>
          <tr><td style="padding:6px 0; color:#666; vertical-align:top;">Message</td><td style="padding:6px 0; white-space:pre-wrap;">${escapeHtml(message)}</td></tr>
        </table>
        <p style="margin-top:20px; font-size:12px; color:#999;">Message ID #${id} · Log in to the admin panel to reply or mark as read.</p>
      </div>
    `,
  });
}

/**
 * Auto-reply / acknowledgement email sent to the visitor who submitted the form.
 */
async function sendVisitorAutoReply({ name, email }) {
  await transporter.sendMail({
    from: fromHeader,
    to: email,
    subject: `Thanks for reaching out, ${name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color:#111;">Message received</h2>
        <p style="font-size:14px; color:#333; line-height:1.6;">
          Hi ${escapeHtml(name)},<br/><br/>
          Thanks for getting in touch! This confirms your message was received.
          I usually reply within 1-2 business days.
        </p>
        <p style="font-size:12px; color:#999; margin-top:24px;">This is an automated confirmation — no need to reply to this email.</p>
      </div>
    `,
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendAdminNotification, sendVisitorAutoReply };
