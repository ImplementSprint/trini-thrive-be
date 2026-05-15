import { Injectable } from '@nestjs/common';
import { SignJWT } from "jose";
import { supabase } from "@shared/supabaseClient";
import { sendOTPEmail } from "@shared/email";
import { JWT_SECRET as JWT_SECRET_RAW } from "@shared/constants";

const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

@Injectable()
export class AuthService {
  /**
   * Generate OTP code
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string) {
    try {
      console.log(`\n[AUTH] Login attempt for: ${email}`);
      
      // Sign in with Supabase Auth to verify credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        console.log(`[AUTH] ❌ Authentication failed: ${error?.message}`);
        const result = {
          success: false,
          error: "Invalid email or password",
        };
        console.log(`[AUTH] Returning error result:`, result);
        return result;
      }

      console.log(`[AUTH] ✅ Credentials verified for: ${email}`);

      // Use Supabase auth user as admin (no separate admins table required)
      const adminData = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || email.split("@")[0],
      };

      console.log(`[AUTH] ✅ Admin user loaded: ${adminData.email}`);

      // Generate OTP
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const expiresAtMs = expiresAt.getTime(); // Convert to milliseconds

      console.log(`[AUTH] Generated OTP: ${otp}`);

      // Store OTP in database - delete old unused OTPs for this email first
      let otpError: any = null;
      
      // Delete any previous unused OTPs for this email (prevents conflicts)
      await supabase
        .from("otp_sessions")
        .delete()
        .eq("email", email)
        .eq("used", false);

      const { error: error1 } = await supabase
        .from("otp_sessions")
        .insert({
          email,
          otp,
          expires_at_ms: expiresAtMs,
          created_at_ms: Date.now(),
          used: false,
        });

      if (error1) {
        console.error(`[AUTH] ❌ OTP storage error:`, error1);
        return {
          success: false,
          error: "Failed to generate OTP",
        };
      }

      console.log(`[AUTH] ✅ OTP stored in database`);

      // Send OTP via email using the email service
      console.log(`[AUTH] 📧 Sending OTP to ${email}...`);
      const emailSent = await sendOTPEmail(email, otp);

      if (!emailSent) {
        console.error(`[AUTH] ❌ Failed to send OTP email`);
        return {
          success: false,
          error: "Failed to send OTP email",
        };
      }

      console.log(`[AUTH] ✅✅ OTP sent successfully to ${email}`);

      return {
        success: true,
        message: "OTP sent to email. Please check your inbox.",
        email: adminData.email,
        adminId: adminData.id,
        requiresOtp: true,
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  }

  /**
   * Verify OTP and generate JWT token
   */
  async verifyOTP(email: string, otp: string) {
    try {
      console.log(`\n[AUTH] OTP verification attempt for: ${email}, OTP: ${otp}`);
      
      // Verify OTP from database - check expires_at_ms (milliseconds)
      const now = Date.now();
      console.log(`[AUTH] Current time: ${now}`);
      console.log(`[AUTH] Looking for OTP: email=${email}, otp=${otp}, used=false, expires_at_ms>${now}`);
      
      try {
        console.log(`[AUTH] Attempting to query OTP...`);
        
        // Try a simple test query first
        const { data: testData, error: testError } = await supabase
          .from("otp_sessions")
          .select("id, email, otp, used")
          .eq("email", email)
          .limit(5);

        console.log(`[AUTH] Test query error:`, testError);
        console.log(`[AUTH] Test query found ${testData?.length || 0} records for ${email}`);

        if (testData && testData.length > 0) {
          testData.forEach((record: any) => {
            console.log(`[AUTH] Found record: otp=${record.otp}, used=${record.used}`);
          });
        }

        // Now try the full query
        const { data: otpData, error: otpError } = await supabase
          .from("otp_sessions")
          .select("*")
          .eq("email", email)
          .eq("otp", otp.toString())
          .eq("used", false)
          .gt("expires_at_ms", now);

        console.log(`[AUTH] Final query error:`, otpError);
        console.log(`[AUTH] Final query data count:`, otpData?.length || 0);

        if (otpError) {
          console.error(`[AUTH] ❌ OTP query error details:`, {
            message: otpError.message,
            code: otpError.code,
            details: otpError.details,
            hint: otpError.hint,
          });
          return {
            success: false,
            error: "Invalid or expired OTP",
          };
        }

        if (!otpData || otpData.length === 0) {
          console.log(`[AUTH] ❌ No OTP record found for ${email} with OTP ${otp}`);
          return {
            success: false,
            error: "Invalid or expired OTP",
          };
        }

        const otp_record = otpData[0];
        console.log(`[AUTH] ✅ OTP record found:`, otp_record);
        
        // Mark OTP as used
        const { error: updateError } = await supabase
          .from("otp_sessions")
          .update({ used: true })
          .eq("id", otp_record.id);

        if (updateError) {
          console.error(`[AUTH] ❌ Failed to mark OTP as used:`, updateError);
        }

        console.log(`[AUTH] ✅ OTP verified for ${email}`);
      } catch (error) {
        console.error(`[AUTH] ❌ OTP verification exception:`, error);
        return {
          success: false,
          error: "Failed to verify OTP",
        };
      }

      // Get admin data continues below

      // Get admin data from Supabase auth
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      let adminData;
      if (authError || !authUsers) {
        console.log(`[AUTH] ⚠️ Could not fetch auth users, using email for basic info`);
        adminData = {
          id: "unknown",
          email: email,
          name: email.split("@")[0],
        };
      } else {
        const authUser = authUsers.users.find(u => u.email === email);
        if (!authUser) {
          console.error(`[AUTH] ❌ User not found in auth`);
          return {
            success: false,
            error: "User not found",
          };
        }
        adminData = {
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || email.split("@")[0],
        };
      }

      console.log(`[AUTH] ✅ Admin info loaded: ${adminData.email}`);

      // Generate JWT token
      const token = await new SignJWT({
        sub: adminData.id,
        email: adminData.email,
        name: adminData.name,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("24h")
        .sign(JWT_SECRET);

      console.log(`[AUTH] ✅✅ JWT token generated for ${email}`);

      return {
        success: true,
        message: "OTP verified successfully",
        token,
        admin: adminData,
        verified: true,
      };
    } catch (error) {
      console.error("OTP verification error:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string
  ) {
    try {
      console.log(`🔐 Changing password for ${email}`);
      
      // Step 1: Verify current password by signing in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError || !signInData.user) {
        console.log(`❌ Current password verification failed for ${email}`);
        return {
          success: false,
          error: "Current password is incorrect",
        };
      }

      // Step 2: Update password in Supabase using admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        signInData.user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error(`❌ Failed to update password for ${email}:`, updateError.message);
        return {
          success: false,
          error: "Failed to update password in Supabase",
        };
      }

      console.log(`✅ Password updated successfully for ${email}`);
      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error) {
      console.error("Change password error:", error);
      return {
        success: false,
        error: "Failed to change password",
      };
    }
  }
}

