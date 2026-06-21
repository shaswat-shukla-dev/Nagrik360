const nodemailer = require('nodemailer');

function getTransport() {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@gmail.com') return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendGovReport({ report, complaintText }) {
  const transport = getTransport();
  const refId = `N360-${Date.now().toString(36).toUpperCase()}`;

  if (!transport) {
    // Dev / no-SMTP fallback: simulate success so the flow is fully testable
    console.log('[MAIL SIMULATED] Gov report would be sent. Ref:', refId);
    return { simulated: true, refId };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.GOV_REPORT_EMAIL,
    subject: `[Nagrik360 Civic Report #${refId}] ${report.category}`,
    text: `${complaintText}\n\nCategory: ${report.category}\nLocation: ${report.latitude}, ${report.longitude}\nAddress: ${report.address || 'N/A'}\nSeverity: ${report.severity}\nReference ID: ${refId}\nImage: attached if available.`,
  });

  return { simulated: false, refId };
}

module.exports = { sendGovReport };
