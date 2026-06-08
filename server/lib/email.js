const nodemailer = require('nodemailer');

function createTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

async function sendPasswordResetEmail(toEmail, code) {
    const transport = createTransport();
    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: toEmail,
        subject: 'Reset your FitForce X password',
        text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.`,
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <h2 style="margin-bottom:8px">Reset your password</h2>
                <p style="color:#555;margin-bottom:24px">Enter this code on the reset password page. It expires in 15 minutes.</p>
                <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">
                    ${code}
                </div>
                <p style="color:#888;font-size:13px;margin-top:24px">If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });
}

module.exports = { sendPasswordResetEmail };
