import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }

  private resolve(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const message = this.extractHttpMessage(raw, status);
      return { status, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: this.mapPrismaError(exception),
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Some of the information provided is invalid. Please check and try again.',
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'We are having trouble connecting to the database. Please try again shortly.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our side. Please try again in a few minutes.',
    };
  }

  private extractHttpMessage(raw: string | object, status: number): string {
    if (typeof raw === 'string') {
      return this.sanitize(raw, status);
    }
    if (typeof raw === 'object' && raw !== null && 'message' in raw) {
      const msg = (raw as { message: string | string[] }).message;
      if (Array.isArray(msg)) {
        return msg.map((m) => this.sanitize(String(m), status)).join(' ');
      }
      if (typeof msg === 'string') {
        return this.sanitize(msg, status);
      }
    }
    return this.defaultForStatus(status);
  }

  private sanitize(message: string, status: number): string {
    if (/prisma|invocation|findUnique|postgres|query_engine/i.test(message)) {
      return 'Something went wrong while processing your request. Please try again.';
    }
    return message.length > 200 ? this.defaultForStatus(status) : message;
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): string {
    switch (error.code) {
      case 'P2002':
        return 'This record already exists. Please use different details.';
      case 'P2025':
        return 'The item you are looking for could not be found.';
      case 'P2003':
        return 'This action could not be completed because related information is missing.';
      default:
        return 'Something went wrong while saving your data. Please try again.';
    }
  }

  private defaultForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'The request could not be understood. Please check your input.',
      401: 'Please sign in to continue.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'This action conflicts with existing data.',
      422: 'Some of the information provided is invalid.',
      500: 'Something went wrong on our side. Please try again in a few minutes.',
      503: 'The service is temporarily unavailable. Please try again shortly.',
    };
    return map[status] ?? map[500];
  }
}
