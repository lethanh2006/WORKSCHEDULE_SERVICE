import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ConnectionStates, type Connection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  getHealth() {
    return { status: 'ok' as const, service: 'workschedule' as const };
  }
  getReadiness() {
    const mongodb: 'up' | 'down' =
      this.connection.readyState === ConnectionStates.connected ? 'up' : 'down';
    const response = {
      status: mongodb === 'up' ? ('ok' as const) : ('error' as const),
      service: 'workschedule' as const,
      dependencies: { mongodb },
    };
    if (mongodb === 'down') throw new ServiceUnavailableException(response);
    return response;
  }
}
