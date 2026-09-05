import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  InternalServerErrorException,
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
        // Anything else (e.g. P2022 "column does not exist" from a schema
        // drift, P2024 pool-timeout, a raw connection failure) is not a
        // conflict — mislabeling it as 409 sends debugging in the wrong
        // direction. Surface it as a real server error instead.
        this.logger.error(
          `Unhandled Prisma error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        return new InternalServerErrorException(
          `Database request could not be completed (${exception.code})`,
        );
    }
  }
}
