import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AttendanceRecord,
  AttendanceRecordSchema,
} from "../../schemas/attendance-record.schema";
import {
  ScheduleEntry,
  ScheduleEntrySchema,
} from "../../schemas/schedule-entry.schema";
import {
  ScheduleRequest,
  ScheduleRequestSchema,
} from "../../schemas/schedule-request.schema";
import { WorkPolicy, WorkPolicySchema } from "../../schemas/work-policy.schema";
import { UserClientModule } from "../user-client/user-client.module";
import { ScheduleController } from "./schedule.controller";
import { ScheduleService } from "./schedule.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduleRequest.name, schema: ScheduleRequestSchema },
      { name: ScheduleEntry.name, schema: ScheduleEntrySchema },
      { name: WorkPolicy.name, schema: WorkPolicySchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
    ]),
    UserClientModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
