import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  return transporter;
}

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  const client = getTransporter();
  if (!client) {
    console.warn(`SMTP not configured; skipping email "${input.subject}" to ${input.to}`);
    return;
  }

  await client.sendMail({
    from: process.env.SMTP_FROM ?? "alerts@luggalink.app",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
