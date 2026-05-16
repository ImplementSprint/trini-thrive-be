import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import * as nodemailer from 'nodemailer';

interface ResetTokenPayload {
  sub: string;
  purpose: 'password_reset';
}

@Injectable()
export class AuthService {
  private get admin() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  private get mailer() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const admin = this.admin;

    // Verify the email exists in beneficiary_profiles
    const { data: profile, error: profileError } = await admin
      .from('beneficiary_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Database error');
    }

    if (!profile) {
      throw new NotFoundException('No account found with that email address');
    }

    // Clear any existing unused OTPs for this email
    await admin
      .from('otp_sessions')
      .delete()
      .eq('email', email)
      .eq('used', false);

    // Generate and store new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;

    const { error: insertError } = await admin.from('otp_sessions').insert({
      email,
      otp,
      expires_at_ms: expiresAtMs,
      created_at_ms: now,
      used: false,
    });

    if (insertError) {
      throw new InternalServerErrorException('Failed to create OTP session');
    }

    // Send OTP email
    try {
      await this.mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your HOPECARD Password Reset Code',
        html: `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fff8f7; border-radius: 16px;">
            <h2 style="color: #97453e; margin: 0 0 8px;">Password Reset</h2>
            <p style="color: #554240; margin: 0 0 24px;">Use the code below to reset your HOPECARD password. It expires in 10 minutes.</p>
            <div style="background: #fff; border: 1px solid #dac1be4d; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 2.5rem; font-weight: 800; letter-spacing: 0.3em; color: #241918;">${otp}</span>
            </div>
            <p style="color: #554240; font-size: 0.875rem; margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch {
      throw new InternalServerErrorException('Failed to send OTP email');
    }

    return { success: true, message: 'A verification code has been sent to your email address.' };
  }

  async verifyResetOtp(email: string, otp: string): Promise<{ reset_token: string }> {
    const admin = this.admin;
    const now = Date.now();

    const { data: session, error } = await admin
      .from('otp_sessions')
      .select('id, expires_at_ms')
      .eq('email', email)
      .eq('otp', otp)
      .eq('used', false)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Database error');
    }

    if (!session) {
      throw new BadRequestException('Invalid or already-used verification code');
    }

    if (now > session.expires_at_ms) {
      throw new BadRequestException('Verification code has expired');
    }

    // Mark OTP as used
    await admin
      .from('otp_sessions')
      .update({ used: true })
      .eq('id', session.id);

    const secret = process.env.RESET_TOKEN_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('Reset token secret not configured');
    }

    const reset_token = jwt.sign(
      { sub: email, purpose: 'password_reset' } satisfies ResetTokenPayload,
      secret,
      { expiresIn: '15m' },
    );

    return { reset_token };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ success: boolean }> {
    const secret = process.env.RESET_TOKEN_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('Reset token secret not configured');
    }

    let payload: ResetTokenPayload;
    try {
      payload = jwt.verify(resetToken, secret) as ResetTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.purpose !== 'password_reset') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const email = payload.sub;
    const admin = this.admin;

    // Look up the user's auth ID via beneficiary_profiles
    const { data: profile, error: profileError } = await admin
      .from('beneficiary_profiles')
      .select('auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (profileError || !profile) {
      throw new NotFoundException('User not found');
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      profile.auth_user_id,
      { password: newPassword },
    );

    if (updateError) {
      throw new InternalServerErrorException('Failed to update password');
    }

    return { success: true };
  }
}
