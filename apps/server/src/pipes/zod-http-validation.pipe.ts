import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

@Injectable()
export class ZodHttpValidationPipe implements PipeTransform {
  constructor(private schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const { path, message } = result.error.issues[0];
      const field = path.join('.');
      throw new BadRequestException(field ? `${field}: ${message}` : message);
    }
    return result.data;
  }
}
