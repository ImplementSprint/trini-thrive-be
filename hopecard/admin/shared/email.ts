import nodemailer from 'nodemailer';

// Configure email transporter using environment variables
const createEmailTransporter = () => {
  console.log('\n[EMAIL] Creating transporter with config:');
  console.log(`[EMAIL] SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`[EMAIL] SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`[EMAIL] SMTP_SECURE: ${process.env.SMTP_SECURE}`);
  console.log(`[EMAIL] SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`[EMAIL] SMTP_FROM: ${process.env.SMTP_FROM}`);

  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  console.log('[EMAIL] Transporter config:', JSON.stringify({ ...config, auth: { user: config.auth.user, pass: '***' } }));
  
  return nodemailer.createTransport(config);
};

/**
 * Send OTP email
 */
export async function sendOTPEmail(to: string, otp: string): Promise<boolean> {
  try {
    console.log(`\n[EMAIL] sendOTPEmail called for: ${to}, OTP: ${otp}`);

    // Check if email credentials are configured
    const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD;

    console.log(`[EMAIL] hasSmtp: ${hasSmtp}`);

    if (!hasSmtp) {
      console.warn('[EMAIL] Email credentials not configured. Logging OTP to console only.');
      console.log(`\n📧 OTP EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`OTP: ${otp}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;

    console.log(`[EMAIL] Creating transporter...`);
    const transporter = createEmailTransporter();

    console.log(`[EMAIL] Sending mail from ${fromAddress} to ${to}...`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: to,
      subject: 'Your HopeCard Admin OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9b2c2c;">HopeCard Admin Login</h2>
          <p>Your one-time password (OTP) is:</p>
          <h1 style="color: #9b2c2c; letter-spacing: 5px; font-size: 32px; text-align: center; margin: 20px 0;">
            ${otp}
          </h1>
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p style="color: #666; font-size: 14px;">
            If you did not request this code, please ignore this email and do not share it with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            © 2026 HopeCard. All rights reserved.
          </p>
        </div>
      `,
    });

    console.log(`\n✅ [EMAIL] Email sent successfully!`);
    console.log(`Response ID: ${info.response}`);
    console.log(`---\n`);

    return true;
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending OTP email:`, error);
    return false;
  }
}
