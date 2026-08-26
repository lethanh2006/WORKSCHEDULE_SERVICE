import { createAppLogger, PinoNestLogger } from '@nrapp/observability';

export const appLogger: ReturnType<typeof createAppLogger> = createAppLogger({
  serviceName: 'workschedule',
});

export const nestLogger = new PinoNestLogger(appLogger, 'Workschedule');
