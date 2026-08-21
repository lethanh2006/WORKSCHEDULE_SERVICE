import dns from "node:dns";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { toError } from "./common/utils/error.util";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 5004);
}

bootstrap().catch((reason: unknown) => {
  const error = toError(reason);
  new Logger("Bootstrap").error(
    `Không thể khởi động dịch vụ lịch làm việc: ${error.message}`,
    error.stack,
  );
  process.exitCode = 1;
});
