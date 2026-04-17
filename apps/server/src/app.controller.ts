import { Controller, Get } from '@nestjs/common';
import { httpOK } from './utils/http-response.util';

// Root controller — kept minimal. Feature routes live in their own modules.
@Controller()
export class AppController {
  /**
   * Health check endpoint. Returns a 200 success envelope to confirm the
   * server is running and reachable.
   */
  @Get('health')
  health() {
    return httpOK({});
  }
}
