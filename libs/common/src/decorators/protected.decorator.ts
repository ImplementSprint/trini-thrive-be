import { UseGuards } from "@nestjs/common";
import { JwtGuard } from "../guards/jwt.guard";

/**
 * Decorator to protect routes with JWT authentication
 * Usage: @Protected() on controller or method
 */
export const Protected = () => UseGuards(new JwtGuard());
