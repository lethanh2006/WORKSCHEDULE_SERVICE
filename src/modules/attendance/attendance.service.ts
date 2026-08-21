import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "node:crypto";
import type { Model } from "mongoose";
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from "../../common/interfaces/authenticated-user.interface";
import type { ForwardedRequestContext } from "../../common/utils/request.util";
import { AttendanceQrToken } from "../../schemas/attendance-qr-token.schema";
import { AttendanceRecord } from "../../schemas/attendance-record.schema";
import { ScheduleEntry } from "../../schemas/schedule-entry.schema";
import { ScheduleRequest } from "../../schemas/schedule-request.schema";
import { UserClientService } from "../user-client/user-client.service";
import { ScanAttendanceDto } from "./dto/scan-attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(AttendanceQrToken.name) private readonly tokens: Model<any>,
    @InjectModel(AttendanceRecord.name) private readonly attendance: Model<any>,
    @InjectModel(ScheduleEntry.name) private readonly entries: Model<any>,
    @InjectModel(ScheduleRequest.name) private readonly requests: Model<any>,
    private readonly users: UserClientService,
  ) {}

  async generateQrToken() {
    try {
      const now = new Date();
      const token = await this.tokens.create({
        token: randomBytes(32).toString("hex"),
        date: this.vietnamDate(now),
        expires_at: new Date(now.getTime() + 30_000),
      });
      return { success: true, data: token };
    } catch {
      this.fail("Lỗi hệ thống");
    }
  }

  async scan(dto: ScanAttendanceDto, user: AuthenticatedUser) {
    try {
      const userId = authenticatedUserId(user);
      const now = new Date();
      const token = await this.tokens.findOneAndUpdate(
        { token: dto.token, used: false, expires_at: { $gt: now } },
        { $set: { used: true, used_by: userId, used_at: now } },
        { new: true },
      );
      if (!token) {
        throw new BadRequestException({
          success: false,
          message: "Mã QR không hợp lệ, đã sử dụng hoặc hết hạn",
        });
      }
      const today = this.vietnamDate(now);
      const requests = await this.requests.find({
        employee_id: userId,
        status: "approved",
      });
      const office = await this.entries.findOne({
        request_id: { $in: requests.map((request) => request._id) },
        date: today,
        type: "office",
      });
      if (!office) {
        throw new BadRequestException({
          success: false,
          message:
            "Bạn không có lịch làm việc tại văn phòng được duyệt cho ngày hôm nay",
        });
      }
      let record = await this.attendance.findOne({
        employee_id: userId,
        date: today,
        source: "qr",
      });
      if (!record) {
        record = await this.attendance.create({
          employee_id: userId,
          date: today,
          schedule_type: "office",
          check_in_at: now,
          source: "qr",
          check_in_token_id: token._id,
        });
        return { success: true, message: "Check-in thành công", data: record };
      }
      if (record.check_out_at) {
        throw new BadRequestException({
          success: false,
          message: "Bạn đã check-out hôm nay rồi",
        });
      }
      record.check_out_at = now;
      record.check_out_token_id = token._id;
      await record.save();
      return { success: true, message: "Check-out thành công", data: record };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.fail("Lỗi hệ thống");
    }
  }

  async getMine(query: Record<string, string>, user: AuthenticatedUser) {
    try {
      const filter: any = { employee_id: authenticatedUserId(user) };
      if (query.from || query.to) {
        filter.date = {};
        if (query.from) filter.date.$gte = new Date(query.from);
        if (query.to) filter.date.$lte = new Date(query.to);
      }
      const rows = await this.attendance.find(filter).sort({ date: -1 });
      const data = rows.map((row) => ({ ...row.toObject(), employee: user }));
      return { success: true, count: data.length, data };
    } catch {
      this.fail("Lỗi hệ thống");
    }
  }

  async getToday(context: ForwardedRequestContext) {
    try {
      const rows = await this.attendance.find({
        date: this.vietnamDate(new Date()),
        check_in_at: { $exists: true },
      });
      const data = await this.users.enrichRows(rows, context);
      return { success: true, count: data.length, data };
    } catch {
      this.fail("Lỗi hệ thống");
    }
  }

  async getReport(
    query: Record<string, string>,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = {};
      if (query.employee_id) filter.employee_id = query.employee_id;
      if (query.from || query.to) {
        filter.date = {};
        if (query.from) filter.date.$gte = new Date(query.from);
        if (query.to) filter.date.$lte = new Date(query.to);
      }
      const rows = await this.attendance.find(filter).sort({ date: -1 });
      const data = await this.users.enrichRows(rows, context);
      return { success: true, count: data.length, data };
    } catch {
      this.fail("Lỗi hệ thống");
    }
  }

  private vietnamDate(now: Date): Date {
    const offset = 7 * 60;
    const local = new Date(
      now.getTime() + (offset + now.getTimezoneOffset()) * 60_000,
    );
    return new Date(
      Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()),
    );
  }

  private fail(message: string): never {
    throw new HttpException(
      { success: false, message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
