import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model, PipelineStage } from "mongoose";
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from "../../common/interfaces/authenticated-user.interface";
import type { ForwardedRequestContext } from "../../common/utils/request.util";
import { AttendanceRecord } from "../../schemas/attendance-record.schema";
import {
  ScheduleEntry,
  type WorkPeriod,
} from "../../schemas/schedule-entry.schema";
import { ScheduleRequest } from "../../schemas/schedule-request.schema";
import {
  normalizeScheduleEntries,
  type NormalizedScheduleEntry,
} from "../../services/scheduleEntryValidator";
import { getWeekStartRange, isMonday, parseIsoWeek } from "../../utils/date";
import { atVietnamTime } from "../../utils/vietnam-time";
import { UserClientService } from "../user-client/user-client.service";
import { PolicyService } from "../policy/policy.service";
import {
  BulkApproveScheduleDto,
  CreateScheduleRequestDto,
  RejectScheduleRequestDto,
  ResubmitScheduleRequestDto,
  UpdateScheduleEntriesDto,
} from "./dto/schedule.dto";

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(ScheduleRequest.name) private readonly requests: Model<any>,
    @InjectModel(ScheduleEntry.name) private readonly entries: Model<any>,
    @InjectModel(AttendanceRecord.name) private readonly attendance: Model<any>,
    private readonly users: UserClientService,
    private readonly policies: PolicyService,
  ) {}

  async getMine(
    query: Record<string, string>,
    user: AuthenticatedUser,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = { employee_id: authenticatedUserId(user) };
      if (typeof query.week === "string") {
        const week = parseIsoWeek(query.week);
        if (week) filter.week_start = getWeekStartRange(week);
      }
      const requests = await this.requests
        .find(filter)
        .sort({ week_start: -1 });
      const data: any[] = [];
      for (const scheduleRequest of requests) {
        const entries = await this.entries.find({
          request_id: scheduleRequest._id,
        });
        const enriched = await this.users.enrichOne(scheduleRequest, context);
        data.push({ ...enriched, entries });
      }
      return { success: true, data };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async create(dto: CreateScheduleRequestDto, user: AuthenticatedUser) {
    try {
      if (!isMonday(dto.week_start)) {
        throw new BadRequestException({
          success: false,
          message: "Tuần đăng ký phải bắt đầu từ thứ Hai.",
        });
      }
      const normalized = normalizeScheduleEntries(
        dto.entries,
        new Date(dto.week_start),
      );
      if (!normalized.entries) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      const employeeId = authenticatedUserId(user);
      const existing = await this.requests.findOne({
        employee_id: employeeId,
        week_start: getWeekStartRange(new Date(dto.week_start)),
      });
      if (existing) {
        throw new BadRequestException({
          success: false,
          message: "Schedule request for this week already exists",
        });
      }

      await this.validateRegistrationPolicy(dto.week_start, user);

      const request = new this.requests({
        employee_id: employeeId,
        week_start: dto.week_start,
        status: "pending",
        submitted_at: new Date(),
      });
      try {
        await this.entries.insertMany(
          normalized.entries.map((entry) => ({
            request_id: request._id,
            date: entry.date,
            type: entry.type,
            period: entry.period,
            note: entry.note,
          })),
        );
        await request.save();
      } catch (error) {
        await this.entries.deleteMany({ request_id: request._id });
        throw error;
      }
      return { success: true, data: request };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async resubmit(
    id: string,
    dto: ResubmitScheduleRequestDto,
    user: AuthenticatedUser,
  ) {
    try {
      const employeeId = authenticatedUserId(user);
      const request = await this.requests.findOne({
        _id: id,
        employee_id: employeeId,
      });
      if (!request) {
        throw new NotFoundException({
          success: false,
          message: "Schedule request not found",
        });
      }
      if (request.status !== "rejected") {
        throw new BadRequestException({
          success: false,
          message: "Chỉ có thể gửi lại lịch đã bị từ chối",
        });
      }

      const normalized = normalizeScheduleEntries(
        dto.entries,
        new Date(request.week_start),
      );
      if (!normalized.entries) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      await this.validateRegistrationPolicy(request.week_start, user);

      await this.replaceScheduleEntries(id, normalized.entries);
      const resubmitted = await this.requests.findOneAndUpdate(
        { _id: id, employee_id: employeeId, status: "rejected" },
        {
          $set: {
            status: "pending",
            submitted_at: new Date(),
          },
          $unset: {
            reject_reason: "",
            reviewed_by: "",
            reviewed_at: "",
          },
        },
        { new: true, runValidators: true },
      );
      if (!resubmitted) {
        throw new BadRequestException({
          success: false,
          message: "Lịch đã được xử lý, không thể gửi lại",
        });
      }
      return {
        success: true,
        message: "Resubmitted successfully",
        data: resubmitted,
      };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async getInfo(id: string, context: ForwardedRequestContext) {
    try {
      const request = await this.requests.findById(id);
      if (!request) {
        throw new NotFoundException({
          success: false,
          message: "Request not found",
        });
      }
      const entries = await this.entries.find({ request_id: id });
      const enriched = await this.users.enrichOne(request, context);
      return { success: true, data: { ...enriched, entries } };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async update(id: string, dto: UpdateScheduleEntriesDto) {
    try {
      const request = await this.requests.findById(id);
      if (!request) {
        throw new NotFoundException({ success: false, message: "Not found" });
      }
      const normalized = normalizeScheduleEntries(
        dto.entries,
        new Date(request.week_start),
      );
      if (!normalized.entries) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      await this.replaceScheduleEntries(id, normalized.entries);
      if (request.status === "approved") {
        await this.syncScheduleAttendance(request, normalized.entries);
      }
      return { success: true, message: "Updated successfully" };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async remove(id: string) {
    try {
      const request = await this.requests.findById(id);
      if (!request)
        throw new NotFoundException({ success: false, message: "Not found" });
      await this.entries.deleteMany({ request_id: id });
      if (request.status === "approved") {
        const end = new Date(request.week_start);
        end.setDate(end.getDate() + 7);
        await this.attendance.deleteMany({
          employee_id: request.employee_id,
          source: "schedule",
          date: { $gte: request.week_start, $lt: end },
        });
      }
      await request.deleteOne();
      return { success: true, message: "Deleted successfully" };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async getPending(
    query: Record<string, string>,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = { status: "pending" };
      const week =
        typeof query.week === "string" ? parseIsoWeek(query.week) : null;
      if (week) filter.week_start = getWeekStartRange(week);
      const rows = await this.requests.find(filter).sort({ submitted_at: 1 });
      const data = await this.users.enrichRows(rows, context);
      return { success: true, count: data.length, data };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async getAll(
    query: Record<string, string>,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = {};
      const week =
        typeof query.week === "string" ? parseIsoWeek(query.week) : null;
      if (week) filter.week_start = getWeekStartRange(week);
      if (query.status && query.status !== "all") filter.status = query.status;
      const rows = await this.requests.find(filter).sort({ week_start: -1 });
      const data = await this.users.enrichRows(rows, context);
      return { success: true, count: data.length, data };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async approve(id: string, user: AuthenticatedUser) {
    try {
      const approved = await this.approveAndSyncAttendance(
        id,
        authenticatedUserId(user),
      );
      if (!approved) {
        throw new BadRequestException({
          success: false,
          message: "Invalid or missing pending request",
        });
      }
      return { success: true, message: "Approved successfully" };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async reject(
    id: string,
    dto: RejectScheduleRequestDto,
    user: AuthenticatedUser,
  ) {
    try {
      const request = await this.requests.findOneAndUpdate(
        { _id: id, status: "pending" },
        {
          $set: {
            status: "rejected",
            reject_reason: dto.reason,
            reviewed_by: authenticatedUserId(user),
            reviewed_at: new Date(),
          },
        },
        { new: true, runValidators: true },
      );
      if (!request) {
        throw new BadRequestException({
          success: false,
          message: "Invalid or missing pending request",
        });
      }
      return { success: true, message: "Rejected successfully" };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async bulkApprove(dto: BulkApproveScheduleDto, user: AuthenticatedUser) {
    try {
      if (!Array.isArray(dto.ids) || dto.ids.length === 0) {
        throw new BadRequestException({
          success: false,
          message: "List ids is required",
        });
      }
      const reviewer = authenticatedUserId(user);
      for (const id of dto.ids) {
        await this.approveAndSyncAttendance(id, reviewer);
      }
      return { success: true, message: "Bulk approval complete" };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async heatmap(query: Record<string, string>) {
    try {
      let week = new Date();
      if (typeof query.week === "string")
        week = parseIsoWeek(query.week) ?? week;
      const requests = await this.requests
        .find({ week_start: getWeekStartRange(week), status: "approved" })
        .select("_id");
      const pipeline: PipelineStage[] = [
        {
          $match: {
            request_id: { $in: requests.map((request) => request._id) },
          },
        },
        {
          $group: { _id: { date: "$date", type: "$type" }, count: { $sum: 1 } },
        },
        {
          $group: {
            _id: "$_id.date",
            stats: { $push: { type: "$_id.type", count: "$count" } },
          },
        },
        { $sort: { _id: 1 } },
      ];
      return { success: true, data: await this.entries.aggregate(pipeline) };
    } catch (error) {
      this.rethrowOrFail(error, "Server Error");
    }
  }

  async monthlyOverview(month: string, user: AuthenticatedUser) {
    try {
      const range = this.monthRange(month);
      if (!range) {
        throw new BadRequestException({
          success: false,
          message: "Tháng cần xem phải có định dạng YYYY-MM.",
        });
      }
      const requests = await this.requests
        .find({ employee_id: authenticatedUserId(user) })
        .select("_id week_start status submitted_at reviewed_at reject_reason")
        .lean();
      const byId = new Map(
        requests.map((request) => [String(request._id), request]),
      );
      const entries = await this.entries
        .find({
          request_id: { $in: requests.map((request) => request._id) },
          date: { $gte: range.start, $lt: range.end },
        })
        .sort({ date: 1 })
        .lean();
      const calendarEntries = entries.map((entry) => {
        const request = byId.get(String(entry.request_id));
        return {
          _id: entry._id,
          schedule_request_id: entry.request_id,
          week_start: request?.week_start,
          request_status: request?.status ?? "pending",
          reject_reason: request?.reject_reason,
          date: entry.date,
          type: entry.type,
          period: entry.period ?? "full_day",
          note: entry.note,
        };
      });
      const active = calendarEntries.filter(
        (entry) => entry.request_status !== "rejected",
      );
      const approved = calendarEntries.filter(
        (entry) => entry.request_status === "approved",
      );
      const sessions = (rows: any[]) =>
        rows.reduce(
          (sum, entry) =>
            sum + (entry.period === "full_day" || !entry.period ? 2 : 1),
          0,
        );
      const sessionsByType = (rows: any[], type: string) =>
        sessions(rows.filter((entry) => entry.type === type));
      const relevant = new Set(
        calendarEntries.map((entry) => String(entry.schedule_request_id)),
      );
      const requestCounts = requests
        .filter((request) => relevant.has(String(request._id)))
        .reduce<Record<string, number>>((result, request) => {
          result[request.status] = (result[request.status] ?? 0) + 1;
          return result;
        }, {});
      return {
        success: true,
        data: {
          month: range.month,
          entries: calendarEntries,
          stats: {
            registered_sessions: sessions(
              active.filter((entry) =>
                ["office", "remote"].includes(entry.type),
              ),
            ),
            approved_sessions: sessions(
              approved.filter((entry) =>
                ["office", "remote"].includes(entry.type),
              ),
            ),
            office_sessions: sessionsByType(approved, "office"),
            remote_sessions: sessionsByType(approved, "remote"),
            leave_sessions: sessionsByType(approved, "leave"),
            day_off_sessions: sessionsByType(approved, "day_off"),
            approved_work_days: new Set(
              approved
                .filter((entry) => ["office", "remote"].includes(entry.type))
                .map((entry) =>
                  new Date(entry.date).toISOString().slice(0, 10),
                ),
            ).size,
            pending_requests: requestCounts.pending ?? 0,
            approved_requests: requestCounts.approved ?? 0,
            rejected_requests: requestCounts.rejected ?? 0,
          },
        },
      };
    } catch (error) {
      this.rethrowOrFail(error, "Không thể tải lịch làm việc trong tháng.");
    }
  }

  private async approveAndSyncAttendance(
    id: string,
    reviewer: string,
  ): Promise<boolean> {
    let request = await this.requests.findById(id);
    if (!request || !["pending", "approved"].includes(request.status)) {
      return false;
    }

    if (request.status === "pending") {
      const transitioned = await this.requests.findOneAndUpdate(
        { _id: id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewed_by: reviewer,
            reviewed_at: new Date(),
          },
        },
        { new: true, runValidators: true },
      );
      if (transitioned) {
        request = transitioned;
      } else {
        request = await this.requests.findOne({ _id: id, status: "approved" });
        if (!request) return false;
      }
    }

    await this.syncScheduleAttendance(request);
    return true;
  }

  private async validateRegistrationPolicy(
    weekStartValue: string | Date,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.role?.toLowerCase() === "admin") return;

    const policy = await this.policies.getActivePolicy();
    const now = new Date();
    if (
      policy.locked ||
      now < policy.registration_start ||
      now > policy.registration_end
    ) {
      throw new BadRequestException({
        success: false,
        message: "Ngoài khoảng thời gian đăng ký lịch làm việc",
      });
    }

    const weekStart = new Date(weekStartValue);
    weekStart.setHours(0, 0, 0, 0);
    const currentMonday = new Date(now);
    const day = currentMonday.getDay();
    currentMonday.setDate(currentMonday.getDate() - (day === 0 ? 6 : day - 1));
    currentMonday.setHours(0, 0, 0, 0);
    const maximum = new Date(currentMonday);
    maximum.setDate(maximum.getDate() + 28);
    maximum.setHours(0, 0, 0, 0);
    if (weekStart > maximum) {
      throw new BadRequestException({
        success: false,
        message:
          "Không được phép đăng ký lịch làm việc quá xa trong tương lai (tối đa 4 tuần tới).",
      });
    }
  }

  private async replaceScheduleEntries(
    requestId: string,
    replacement: NormalizedScheduleEntry[],
  ): Promise<void> {
    await this.entries.bulkWrite(
      replacement.map((entry) => ({
        updateOne: {
          filter: { request_id: requestId, date: entry.date },
          update: {
            $set: {
              type: entry.type,
              period: entry.period,
              ...(entry.note ? { note: entry.note } : {}),
            },
            $setOnInsert: { request_id: requestId, date: entry.date },
            ...(!entry.note ? { $unset: { note: "" } } : {}),
          },
          upsert: true,
        },
      })),
    );

    await this.entries.deleteMany({
      request_id: requestId,
      date: { $nin: replacement.map((entry) => entry.date) },
    });
  }

  private async syncScheduleAttendance(
    request: any,
    scheduleEntries?: NormalizedScheduleEntry[],
  ): Promise<void> {
    const remote = scheduleEntries
      ? scheduleEntries.filter((entry) => entry.type === "remote")
      : await this.entries.find({ request_id: request._id, type: "remote" });

    if (remote.length > 0) {
      await this.attendance.bulkWrite(
        remote.map((entry) => {
          const { checkIn, checkOut } = this.remoteTimes(
            entry.date,
            entry.period,
          );
          return {
            updateOne: {
              filter: {
                employee_id: request.employee_id,
                date: entry.date,
                source: "schedule",
              },
              update: {
                $set: {
                  schedule_type: "remote",
                  check_in_at: checkIn,
                  check_out_at: checkOut,
                },
                $setOnInsert: {
                  employee_id: request.employee_id,
                  date: entry.date,
                  source: "schedule",
                },
              },
              upsert: true,
            },
          };
        }),
      );
    }

    const start = new Date(request.week_start);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    await this.attendance.deleteMany({
      employee_id: request.employee_id,
      source: "schedule",
      date: {
        $gte: start,
        $lt: end,
        $nin: remote.map((entry) => entry.date),
      },
    });
  }

  private remoteTimes(date: Date, period: WorkPeriod) {
    if (period === "morning") {
      return {
        checkIn: atVietnamTime(date, 8, 30),
        checkOut: atVietnamTime(date, 12, 0),
      };
    }
    if (period === "afternoon") {
      return {
        checkIn: atVietnamTime(date, 13, 30),
        checkOut: atVietnamTime(date, 17, 30),
      };
    }
    return {
      checkIn: atVietnamTime(date, 8, 30),
      checkOut: atVietnamTime(date, 17, 30),
    };
  }

  private monthRange(value: unknown) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(
      typeof value === "string" ? value : "",
    );
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    return {
      month: value as string,
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  }

  private rethrowOrFail(error: unknown, message: string): never {
    if (error instanceof HttpException) throw error;
    throw new HttpException(
      { success: false, message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
