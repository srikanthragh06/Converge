import { Controller, Get } from '@nestjs/common';
import { httpOK } from './utils/http-response.util';

// Root controller — kept minimal. Feature routes live in their own modules.
@Controller()
export class AppController {
  @Get('health')
  health() {
    return httpOK();
  }
}
