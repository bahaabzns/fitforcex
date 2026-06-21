import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Email is only deliverable when SMTP credentials are present. Without them
// nodemailer throws on send, and callers (e.g. forgotPassword) swallow that
// into a log — so the code would silently never arrive. Treat unconfigured
// SMTP as a dev fallback instead: print the code to the server log.
const isSmtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

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

interface CodeEmail {
    to: string;
    code: string;
    subject: string;
    heading: string;
    intro: string;
}

async function sendCodeEmail({ to, code, subject, heading, intro }: CodeEmail): Promise<void> {
    if (!isSmtpConfigured) {
        // Dev fallback: no SMTP set up — surface the code so the flow is testable locally.
        console.warn(`[email] SMTP not configured — "${subject}" not sent. Code for ${to}: ${code}`);
        return;
    }

    const transport = createTransport();
    await transport.sendMail({
        from:    env.SMTP_FROM || env.SMTP_USER,
        to,
        subject,
        text:    `${intro}\n\nYour code is: ${code}\n\nThis code expires in 15 minutes.`,
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <h2 style="margin-bottom:8px">${heading}</h2>
                <p style="color:#555;margin-bottom:24px">${intro} It expires in 15 minutes.</p>
                <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">
                    ${code}
                </div>
                <p style="color:#888;font-size:13px;margin-top:24px">If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });
}

export async function sendPasswordResetEmail(toEmail: string, code: string): Promise<void> {
    await sendCodeEmail({
        to:      toEmail,
        code,
        subject: 'Reset your FitForce X password',
        heading: 'Reset your password',
        intro:   'Enter this code on the reset password page.',
    });
}

export async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
    await sendCodeEmail({
        to:      toEmail,
        code,
        subject: 'Verify your FitForce X email',
        heading: 'Verify your email',
        intro:   'Enter this code to confirm your email address.',
    });
}
