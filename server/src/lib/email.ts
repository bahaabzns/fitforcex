import nodemailer from 'nodemailer';
import { env } from '../config/env';

function createTransport() {
    return nodemailer.createTransport({
        host:   env.SMTP_HOST,
        port:   env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    });
}

export async function sendPasswordResetEmail(toEmail: string, code: string): Promise<void> {
    const transport = createTransport();
    await transport.sendMail({
        from:    env.SMTP_FROM || env.SMTP_USER,
        to:      toEmail,
        subject: 'Reset your FitForce X password',
        text:    `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.`,
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

export async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
    const transport = createTransport();
    await transport.sendMail({
        from:    env.SMTP_FROM || env.SMTP_USER,
        to:      toEmail,
        subject: 'Verify your FitForce X email',
        text:    `Your email verification code is: ${code}\n\nThis code expires in 15 minutes.`,
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <h2 style="margin-bottom:8px">Verify your email</h2>
                <p style="color:#555;margin-bottom:24px">Enter this code to confirm your email address. It expires in 15 minutes.</p>
                <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">
                    ${code}
                </div>
            </div>
        `,
    });
}
