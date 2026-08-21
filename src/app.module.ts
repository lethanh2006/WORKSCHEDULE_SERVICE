import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CoreModule } from "./core/core.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { DatabaseModule } from "./modules/database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { PolicyModule } from "./modules/policy/policy.module";
import { ScheduleModule } from "./modules/schedule/schedule.module";
import { WorkRequestModule } from "./modules/work-request/work-request.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../.env", ".env"] }),
    CoreModule,
    DatabaseModule,
    HealthModule,
    PolicyModule,
    ScheduleModule,
    AttendanceModule,
    WorkRequestModule,
  ],
})
export class AppModule {}
