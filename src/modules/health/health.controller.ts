import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  root() {
    return {
      message: 'RentEase API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        properties: '/api/properties',
        leases: '/api/leases',
        invoices: '/api/invoices',
        payments: '/api/payments',
      },
    };
  }

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}

