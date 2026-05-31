import nodemailer from 'nodemailer';

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
 * Send account status (ban/suspension) notification email
 */
export async function sendAccountStatusEmail(
  to: string,
  params: {
    firstName: string;
    status: 'suspended' | 'banned';
    reason: string;
    expiresAt: string | null;
  },
): Promise<boolean> {
  try {
    const { firstName, status, reason, expiresAt } = params;
    const isBan = status === 'banned';
    const actionLabel = isBan ? 'Banned' : 'Suspended';
    const subjectLine = isBan
      ? 'Your HopeCard account has been banned'
      : 'Your HopeCard account has been suspended';

    let durationLine: string;
    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      const now = new Date();
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const formattedDate = esc(
        expiryDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      );
      const diffDaysSafe = esc(String(diffDays));
      durationLine = `This ${esc(status)} will be lifted on <strong>${formattedDate}</strong> (in approximately ${diffDaysSafe} day${diffDays !== 1 ? 's' : ''}).`;
    } else {
      durationLine = isBan
        ? 'This ban is <strong>permanent</strong>.'
        : 'This suspension is <strong>indefinite</strong> until further review.';
    }

    const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD;

    if (!hasSmtp) {
      console.warn('[EMAIL] Email credentials not configured. Logging account status email to console only.');
      console.log(`\n📧 ACCOUNT STATUS EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subjectLine}`);
      console.log(`Status: ${actionLabel} | Reason: ${reason} | Duration: ${durationLine}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: subjectLine,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9b2c2c;">HopeCard Account Notice</h2>
          <p>Hi ${esc(firstName)},</p>
          <p>Your HopeCard account has been <strong>${esc(actionLabel.toLowerCase())}</strong>.</p>
          <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; background:#f8f8f8; font-weight:bold; width:140px;">Action</td>
              <td style="padding: 8px; background:#fff;">${esc(actionLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background:#f8f8f8; font-weight:bold;">Reason</td>
              <td style="padding: 8px; background:#fff;">${esc(reason)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background:#f8f8f8; font-weight:bold;">Duration</td>
              <td style="padding: 8px; background:#fff;">${durationLine}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 14px;">
            If you believe this action was taken in error, please contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">© 2026 HopeCard. All rights reserved.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending account status email:', error);
    return false;
  }
}

/**
 * Send account reactivation notification email
 */
export async function sendAccountReactivationEmail(
  to: string,
  params: {
    firstName: string;
    previousStatus: 'suspended' | 'banned' | string;
    reason: string;
  },
): Promise<boolean> {
  try {
    const { firstName, previousStatus, reason } = params;
    const actionLabel = previousStatus === 'banned' ? 'ban' : 'suspension';

    const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD;

    if (!hasSmtp) {
      console.warn('[EMAIL] Email credentials not configured. Logging reactivation email to console only.');
      console.log(`\n📧 REACTIVATION EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`Subject: Your HopeCard account has been reactivated`);
      console.log(`Previous status: ${actionLabel} | Reason: ${reason}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Your HopeCard account has been reactivated',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d6a4f;">HopeCard Account Reactivated</h2>
          <p>Hi ${esc(firstName)},</p>
          <p>Good news — your HopeCard account ${actionLabel} has been <strong>lifted</strong> and your account is now active again.</p>
          <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; background:#f8f8f8; font-weight:bold; width:140px;">Status</td>
              <td style="padding: 8px; background:#fff;">Active</td>
            </tr>
            <tr>
              <td style="padding: 8px; background:#f8f8f8; font-weight:bold;">Note</td>
              <td style="padding: 8px; background:#fff;">${esc(reason)}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 14px;">
            You can now log in and use all HopeCard features. If you have any questions, please contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">© 2026 HopeCard. All rights reserved.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending reactivation email:', error);
    return false;
  }
}

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

/**
 * Send account approval notification email
 */
export async function sendApprovalEmail(
  to: string,
  params: { name: string; role: string },
): Promise<boolean> {
  try {
    const { name, role } = params;
    const hasSmtp =
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD;

    if (!hasSmtp) {
      console.warn('[EMAIL] SMTP not configured. Logging approval email to console only.');
      console.log(`\n📧 APPROVAL EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`Name: ${name} | Role: ${role}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Your HopeCard application has been approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d6a4f;">HopeCard Application Approved</h2>
          <p>Hi ${esc(name)},</p>
          <p>Great news — your HopeCard <strong>${esc(role)}</strong> application has been <strong>approved</strong>.</p>
          <p>You can now log in and access your account using all HopeCard features available to your role.</p>
          <p style="color: #666; font-size: 14px;">
            If you have any questions, please contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">© 2026 HopeCard. All rights reserved.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending approval email:', error);
    return false;
  }
}

/**
 * Send account rejection notification email
 */
export async function sendRejectionEmail(
  to: string,
  params: { name: string; role: string; reason?: string },
): Promise<boolean> {
  try {
    const { name, role, reason } = params;
    const hasSmtp =
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD;

    if (!hasSmtp) {
      console.warn('[EMAIL] SMTP not configured. Logging rejection email to console only.');
      console.log(`\n📧 REJECTION EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`Name: ${name} | Role: ${role} | Reason: ${reason ?? 'N/A'}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Your HopeCard application was not approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9b2c2c;">HopeCard Application Update</h2>
          <p>Hi ${esc(name)},</p>
          <p>We regret to inform you that your HopeCard <strong>${esc(role)}</strong> application has not been approved at this time.</p>
          ${
            reason
              ? `<table style="width:100%; border-collapse:collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px; background:#f8f8f8; font-weight:bold; width:140px;">Reason</td>
                <td style="padding: 8px; background:#fff;">${esc(reason)}</td>
              </tr>
            </table>`
              : ''
          }
          <p style="color: #666; font-size: 14px;">
            If you believe this decision was made in error or have questions, please contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">© 2026 HopeCard. All rights reserved.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending rejection email:', error);
    return false;
  }
}
