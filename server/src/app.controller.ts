import { Controller, Get } from '@nestjs/common';
import { ok } from './utils/response.util';

// Root controller — kept minimal. Feature routes live in their own modules.
@Controller()
export class AppController {
  @Get('health')
  health() {
    return ok();
  }
}
