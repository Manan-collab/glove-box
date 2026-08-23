import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = this.toHttpException(exception);
    const response = host.switchToHttp().getResponse<Response>();
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private toHttpException(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(
          ', ',
        );
        return new ConflictException(
          target ? `${target} already in use` : 'Resource already exists',
        );
      }
      case 'P2025':
        return new NotFoundException('Resource not found');
      default:
        this.logger.error(
          `Unhandled Prisma error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        return new ConflictException(
          `Database request could not be completed (${exception.code})`,
        );
    }
  }
}
