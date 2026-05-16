import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';
import { SERVICE_PORTS, JWT_SECRET as JWT_SECRET_RAW } from './constants';

const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    console.log(
      `🔑 JWT Guard - Token present: ${!!token}, Authorization Header: ${request.headers.authorization ? "✓" : "✗"}`
    );

    if (!token) {
      console.log("❌ JWT Guard - No token found in Authorization header or cookies");
      throw new UnauthorizedException({
        message: "No JWT token provided",
        error: "MISSING_TOKEN",
        code: "MISSING_AUTH_TOKEN",
      });
    }

    try {
      console.log("🔓 Verifying JWT token...");
      const verified = await jwtVerify(token, JWT_SECRET);
      console.log("✅ JWT Guard - Token verified successfully for:", (verified.payload as any).email);
      request.user = verified.payload;
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ JWT Guard - Token verification failed:", errorMsg);
      
      // Determine error type
      let errorDetails = "Invalid or expired JWT token";
      if (errorMsg.includes("signature")) {
        errorDetails = "Invalid token signature";
      } else if (errorMsg.includes("exp")) {
        errorDetails = "Token has expired";
      } else if (errorMsg.includes("malformed")) {
        errorDetails = "Malformed token format";
      }

      throw new UnauthorizedException({
        message: errorDetails,
        error: "INVALID_TOKEN",
        code: "INVALID_JWT",
      });
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    // Try to get token from Authorization header first
    const authHeader = request.headers.authorization;
    
    if (authHeader) {
      console.log(`📋 Authorization header found: ${authHeader.substring(0, 20)}...`);
      
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        console.log(`✅ Bearer token extracted`);
        return token;
      }
    }

    // Try to get from cookies
    if (request.cookies?.admin_token) {
      console.log(`✅ Token extracted from cookies`);
      return request.cookies.admin_token;
    }

    return undefined;
  }
}
