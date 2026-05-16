import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = "Internal server error";
    let details: any = null;

    if (typeof exceptionResponse === "object") {
      message = (exceptionResponse as any).message || message;
      details = {
        message,
        error: (exceptionResponse as any).error || null,
        path: ctx.getRequest().url,
      };
    } else {
      details = {
        message: exceptionResponse,
        path: ctx.getRequest().url,
      };
    }

    console.error(`❌ HTTP Exception [${status}]:`, details);

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(process.env.NODE_ENV === "development" && { details }),
    });
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = "Internal server error";
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    console.error("❌ Unhandled Exception:", exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(process.env.NODE_ENV === "development" && {
        details: exception instanceof Error ? exception.stack : String(exception),
      }),
    });
  }
}
