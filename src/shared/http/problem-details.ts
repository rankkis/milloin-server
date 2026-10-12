import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  ValidationError,
} from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Response } from 'express';
import { STATUS_CODES } from 'http';

export class ProblemFieldDto {
  @ApiProperty({ description: 'The parameter or field', example: 'latestEnd' })
  field: string;

  @ApiProperty({
    description: 'What is wrong with it',
    example: 'latestEnd must be a valid ISO 8601 date string',
  })
  message: string;
}

/** An error response (RFC 9457 problem details) */
export class ProblemDto {
  @ApiProperty({ example: 'about:blank' })
  type: string;

  @ApiProperty({ description: 'The HTTP status text', example: 'Bad Request' })
  title: string;

  @ApiProperty({ example: 400 })
  status: number;

  @ApiProperty({
    description: 'What went wrong, for people',
    example: 'latestEnd must be a valid ISO 8601 date string',
    required: false,
  })
  detail?: string;

  @ApiProperty({
    description:
      'Each invalid parameter, on 400 responses to a request that failed validation',
    type: [ProblemFieldDto],
    required: false,
  })
  errors?: ProblemFieldDto[];
}

const fieldErrors = (
  errors: ValidationError[],
  parent = '',
): ProblemFieldDto[] =>
  errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({
        field,
        message,
      })),
      ...fieldErrors(error.children ?? [], field),
    ];
  });

/** For the ValidationPipe: a 400 that names each invalid field */
export const validationException = (
  errors: ValidationError[],
): BadRequestException => {
  const fields = fieldErrors(errors);
  return new BadRequestException({
    message: fields.map((error) => error.message).join('; '),
    errors: fields,
  });
};

/**
 * Answers every error as application/problem+json: type, title, status,
 * detail and, for invalid requests, the fields that failed.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
    }

    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof body === 'string'
        ? body
        : (body as Record<string, unknown>)?.message;
    const errors = (body as Record<string, unknown> | undefined)?.errors;
    const problem: ProblemDto = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      ...(typeof message === 'string' && { detail: message }),
      ...(Array.isArray(message) && { detail: message.join('; ') }),
      ...(Array.isArray(errors) && { errors }),
    };
    if (response.headersSent) {
      return;
    }
    response
      .status(status)
      .setHeader('Cache-Control', 'no-store')
      .type('application/problem+json')
      .send(JSON.stringify(problem));
  }
}
