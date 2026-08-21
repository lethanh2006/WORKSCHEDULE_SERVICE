import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AttendanceQrToken,
  AttendanceQrTokenSchema,
} from "../../schemas/attendance-qr-token.schema";
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
import { UserClientModule } from "../user-client/user-client.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceQrToken.name, schema: AttendanceQrTokenSchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: ScheduleEntry.name, schema: ScheduleEntrySchema },
      { name: ScheduleRequest.name, schema: ScheduleRequestSchema },
    ]),
    UserClientModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
