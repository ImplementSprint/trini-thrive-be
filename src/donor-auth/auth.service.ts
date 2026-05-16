import { Injectable, HttpException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private getClients() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey) throw new HttpException('Missing Supabase configuration', 500);
    const supabase = createClient(url, anonKey);
    const admin = createClient(url, serviceKey || anonKey);
    return { url, anonKey, serviceKey, supabase, admin };
  }

  async login(email: string, password: string) {
    const { supabase, admin } = this.getClients();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new HttpException(error.message, 401);

    const userId = data.user?.id;
    const userEmail = data.user?.email || email;

    let { data: profileData, error: profileError } = await admin
      .from('digital_donor_profiles')
      .select('status, role')
      .eq('auth_user_id', userId)
      .single();

    if (profileError || !profileData) {
      const { data: emailProfile, error: emailError } = await admin
        .from('digital_donor_profiles')
        .select('status, role, auth_user_id')
        .eq('email', userEmail)
        .single();

      if (!emailError && emailProfile) {
        profileData = emailProfile;
        profileError = null;
        await admin.from('digital_donor_profiles').update({ auth_user_id: userId }).eq('email', userEmail);
      }
    }

    if (profileError || !profileData) {
      const { data: legacyProfile, error: legacyError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!legacyError && legacyProfile) {
        return { success: true, user: data.user, isLegacyUser: true, role: legacyProfile.role };
      }
      throw new HttpException('Donor profile not found. Please ensure you have completed the signup process or contact support.', 403);
    }

    if (profileData?.status !== 'approved') {
      throw new HttpException({ error: 'Your account is not yet approved', reason: 'pending_approval', status: profileData?.status || 'unknown' }, 403);
    }

    return { success: true, user: data.user, session: data.session };
  }

  async signup(body: {
    email: string; password: string; firstName: string; lastName: string;
    barangay?: string; municipality?: string; province?: string; validIdUrl?: string;
    origin?: string;
  }) {
    const { email, password, firstName, lastName, barangay, municipality, province, validIdUrl, origin } = body;
    if (!email || !password || !firstName || !lastName) {
      throw new HttpException('Missing required fields: email, password, firstName, lastName', 400);
    }
    const { supabase, admin } = this.getClients();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${origin || 'http://localhost:3001'}/auth/callback` },
    });
    if (authError) throw new HttpException(authError.message, 400);
    if (!authData.user?.id) throw new HttpException('Failed to create user account', 400);

    const profileData = {
      auth_user_id: authData.user.id, email, first_name: firstName, last_name: lastName,
      barangay: barangay || null, municipality: municipality || null, province: province || null,
      id_verification_key: validIdUrl || null, status: 'pending', role: 'buyer',
    };

    const { data: existingProfile } = await admin.from('digital_donor_profiles').select('id').eq('email', email).maybeSingle();
    let profileCreated = false;
    let profileError: any = null;

    if (existingProfile) {
      const r = await admin.from('digital_donor_profiles').update(profileData).eq('email', email);
      profileError = r.error;
      if (!r.error) profileCreated = true;
    } else {
      const r = await admin.from('digital_donor_profiles').insert(profileData);
      profileError = r.error;
      if (!r.error) profileCreated = true;
    }

    if (!profileCreated) {
      return { success: true, user: authData.user, profileCreated: false, error: `Account created, but profile setup failed: ${profileError?.message}. Please contact support with code ${profileError?.code}.`, warning: 'Profile creation failed.' };
    }
    return { success: true, user: authData.user, profileCreated: true, message: 'Donor profile created successfully' };
  }

  async sendOtp(email: string) {
    if (!email) throw new HttpException('Email is required', 400);
    const { supabase } = this.getClients();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw new HttpException(error.message, 400);
    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyOtp(email: string, token: string, type = 'email') {
    if (!email || !token) throw new HttpException('Email and OTP token are required', 400);
    const { supabase } = this.getClients();
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: type as any });
    if (error) throw new HttpException(error.message, 401);
    return { success: true, message: 'OTP verified successfully', session: data.session, user: data.user };
  }

  async generateOtp(email: string) {
    if (!email) throw new HttpException('Email is required', 400);
    const { supabase } = this.getClients();

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAtMs = now + 10 * 60 * 1000;

    await supabase.from('otp_sessions').delete().eq('email', email).eq('used', false);
    await supabase.from('otp_sessions').insert({ email, otp: otpCode, created_at_ms: now, expires_at_ms: expiresAtMs, used: false });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD?.replace(/\s/g, '') },
    });

    try {
      await transporter.sendMail({
        from: `${process.env.SMTP_FROM || 'Hopecard'} <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your OTP Code - Hopecard',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#6A1B1B">Password Reset Request</h2><p>Your OTP code is:</p><div style="background:#f5f5f5;padding:20px;border-radius:8px;text-align:center;margin:20px 0"><h1 style="color:#6A1B1B;letter-spacing:5px;margin:0">${otpCode}</h1></div><p style="color:#666">This code will expire in 10 minutes.</p></div>`,
      });
    } catch (emailError: any) {
      const detail = emailError?.responseCode === 535 ? 'SMTP authentication failed.' : emailError?.message || 'Unknown error';
      throw new HttpException(`Failed to send OTP email: ${detail}`, 500);
    }

    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyNumericOtp(email: string, code: string) {
    if (!email || !code) throw new HttpException('Email and OTP code are required', 400);
    const { supabase } = this.getClients();
    const { data, error } = await supabase.from('otp_sessions').select('*').eq('email', email).eq('used', false).single();
    if (error || !data) throw new HttpException('No active OTP request found for this email', 404);
    if (Date.now() > data.expires_at_ms) throw new HttpException('OTP has expired. Please request a new one.', 410);
    if (data.otp !== code) throw new HttpException('Invalid OTP code', 401);

    await supabase.from('otp_sessions').update({ used: true }).eq('id', data.id);
    const sessionToken = Buffer.from(JSON.stringify({ email, verified: true, timestamp: Date.now() })).toString('base64');
    return { success: true, message: 'OTP verified successfully', sessionToken, email };
  }

  async checkEmail(email: string) {
    if (!email) throw new HttpException('Email is required', 400);
    const { admin } = this.getClients();
    const { data: users, error } = await admin.auth.admin.listUsers();
    if (error) throw new HttpException('Failed to verify email', 500);
    const userExists = (users.users as any[]).some((u) => u.email === email);
    if (!userExists) throw new HttpException('Email not found. Please sign up first.', 404);
    return { success: true, exists: true };
  }

  async resetPasswordWithOtp(email: string, password: string, sessionToken: string) {
    if (!email) throw new HttpException('Email is required', 400);
    if (!password) throw new HttpException('New password is required', 400);
    if (!sessionToken) throw new HttpException('Session expired or invalid. Please request a new OTP.', 400);

    let tokenData: any;
    try {
      tokenData = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf-8'));
      if (tokenData.email !== email || !tokenData.verified) throw new Error('invalid');
    } catch {
      throw new HttpException('Invalid session token', 401);
    }

    const { admin, supabase } = this.getClients();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceKey) {
      const { data: users, error } = await admin.auth.admin.listUsers();
      if (error) throw new HttpException('Failed to find user', 500);
      const user = (users.users as any[]).find((u) => u.email === email);
      if (!user) throw new HttpException('User not found', 404);
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
      if (updateError) throw new HttpException(updateError.message, 400);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback`,
      });
      if (error) throw new HttpException(error.message, 400);
    }

    return { success: true, message: 'Password updated successfully' };
  }

  async updatePassword(password: string, accessToken: string) {
    if (!password || !accessToken) throw new HttpException('Password and access token are required', 400);
    const { supabase } = this.getClients();
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: '' } as any);
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw new HttpException(error.message, 400);
    return { success: true, message: 'Password updated successfully', user: data.user };
  }

  async uploadId(file: Express.Multer.File, userId: string) {
    if (!file) throw new HttpException('No file provided', 400);
    if (!userId) throw new HttpException('User ID is required', 400);

    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimes.includes(file.mimetype)) throw new HttpException('Invalid file type. Only JPG, PNG, and PDF are allowed.', 400);
    if (file.size > 5 * 1024 * 1024) throw new HttpException('File size must not exceed 5MB', 400);

    const { admin } = this.getClients();
    const ext = file.originalname.split('.').pop();
    const filename = `${userId}/${Date.now()}-valid-id.${ext}`;

    const { data, error } = await admin.storage.from('donor-ids').upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        throw new HttpException({ success: false, warning: 'Storage bucket not configured.', error: error.message }, 503);
      }
      throw new HttpException(`Failed to upload file: ${error.message}`, 400);
    }

    const { data: { publicUrl } } = admin.storage.from('donor-ids').getPublicUrl(filename);
    return { success: true, path: data.path, url: publicUrl, message: 'ID uploaded successfully' };
  }
}
