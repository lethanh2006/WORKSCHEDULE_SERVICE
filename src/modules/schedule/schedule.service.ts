import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage } from 'mongoose';
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from '../../common/interfaces/authenticated-user.interface';
import type { ForwardedRequestContext } from '../../common/utils/request.util';
import { AttendanceRecord } from '../../schemas/attendance-record.schema';
import {
  ScheduleEntry,
  type WorkPeriod,
} from '../../schemas/schedule-entry.schema';
import { ScheduleRequest } from '../../schemas/schedule-request.schema';
import {
  normalizeScheduleEntries,
  type NormalizedScheduleEntry,
} from './utils/schedule-entry-validator';
import { getWeekStartRange, parseIsoWeek } from '../../utils/date';
import { atVietnamTime } from '../../utils/vietnam-time';
import {
  policyScheduleMonth,
  scheduleMonthRange,
  vietnamDateKey,
} from '../../utils/schedule-month';
import { UserClientService } from '../user-client/user-client.service';
import { PolicyService } from '../policy/policy.service';
import {
  BulkApproveScheduleDto,
  CreateScheduleRequestDto,
  RejectScheduleRequestDto,
  ResubmitScheduleRequestDto,
  UpdateScheduleEntriesDto,
} from './dto/schedule.dto';

@Injectable()
export class ScheduleService implements OnModuleInit {
  constructor(
    @InjectModel(ScheduleRequest.name) private readonly requests: Model<any>,
    @InjectModel(ScheduleEntry.name) private readonly entries: Model<any>,
    @InjectModel(AttendanceRecord.name) private readonly attendance: Model<any>,
    private readonly users: UserClientService,
    private readonly policies: PolicyService,
  ) {}

  async onModuleInit() {
    // Build the monthly uniqueness constraint before retiring the weekly one.
    // A legacy Monday request can share its date with the first of a month.
    await this.requests.collection.createIndex(
      { employee_id: 1, month: 1 },
      { unique: true, partialFilterExpression: { month: { $type: 'string' } } },
    );
    const indexes = await this.requests.collection.indexes();
    if (indexes.some((index) => index.name === 'employee_id_1_week_start_1')) {
      try {
        await this.requests.collection.dropIndex('employee_id_1_week_start_1');
      } catch (error: unknown) {
        // Another replica may already have retired the legacy index.
        if (!(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 27
        ))
          throw error;
      }
    }
  }

  async getMine(
    query: Record<string, string>,
    user: AuthenticatedUser,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = {
        employee_id: authenticatedUserId(user),
        ...this.requestPeriodFilter(query),
      };
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
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async create(dto: CreateScheduleRequestDto, user: AuthenticatedUser) {
    try {
      const range = scheduleMonthRange(dto.month);
      if (!range) {
        throw new BadRequestException({
          success: false,
          message: 'Tháng đăng ký phải có định dạng YYYY-MM.',
        });
      }
      const normalized = normalizeScheduleEntries(dto.entries, dto.month);
      if (!normalized.entries) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      const employeeId = authenticatedUserId(user);
      const existing = await this.requests.findOne({
        employee_id: employeeId,
        month: dto.month,
      });
      if (existing) {
        throw new BadRequestException({
          success: false,
          message:
            'Bạn đã có đăng ký trong tháng này. Hãy xem trạng thái hoặc gửi lại lịch bị từ chối.',
        });
      }

      await this.validateRegistrationPolicy(dto.month);
      await this.validatePastEntries(normalized.entries);
      await this.validateLegacyOverlap(employeeId, normalized.entries);

      const request = new this.requests({
        employee_id: employeeId,
        // Retain the legacy required field/index while monthly readers use month.
        week_start: range.start,
        month: dto.month,
        status: 'pending',
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
      this.rethrowOrFail(error, 'Server Error');
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
          message: 'Schedule request not found',
        });
      }
      if (request.status !== 'rejected') {
        throw new BadRequestException({
          success: false,
          message: 'Chỉ có thể gửi lại lịch đã bị từ chối',
        });
      }

      const month = this.editableRequestMonth(request);
      const normalized = normalizeScheduleEntries(dto.entries, month);
      if (!normalized.entries) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      await this.validateRegistrationPolicy(month);
      await this.validatePastEntries(normalized.entries, id);
      await this.validateLegacyOverlap(employeeId, normalized.entries);

      await this.replaceScheduleEntries(id, normalized.entries);
      const resubmitted = await this.requests.findOneAndUpdate(
        { _id: id, employee_id: employeeId, status: 'rejected' },
        {
          $set: {
            status: 'pending',
            submitted_at: new Date(),
          },
          $unset: {
            reject_reason: '',
            reviewed_by: '',
            reviewed_at: '',
          },
        },
        { new: true, runValidators: true },
      );
      if (!resubmitted) {
        throw new BadRequestException({
          success: false,
          message: 'Lịch đã được xử lý, không thể gửi lại',
        });
      }
      return {
        success: true,
        message: 'Resubmitted successfully',
        data: resubmitted,
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async getInfo(id: string, context: ForwardedRequestContext) {
    try {
      const request = await this.requests.findById(id);
      if (!request) {
        throw new NotFoundException({
          success: false,
          message: 'Request not found',
        });
      }
      const entries = await this.entries.find({ request_id: id });
      const enriched = await this.users.enrichOne(request, context);
      return { success: true, data: { ...enriched, entries } };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async update(id: string, dto: UpdateScheduleEntriesDto) {
    try {
      const request = await this.requests.findById(id);
      if (!request) {
        throw new NotFoundException({ success: false, message: 'Not found' });
      }
      const month = this.editableRequestMonth(request);
      const normalized = normalizeScheduleEntries(dto.entries, month);
      if (!normalized.entries) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      await this.validatePastEntries(normalized.entries, id);
      await this.validateLegacyOverlap(
        String(request.employee_id),
        normalized.entries,
      );
      await this.replaceScheduleEntries(id, normalized.entries);
      if (request.status === 'approved') {
        await this.syncScheduleAttendance(request, normalized.entries);
      }
      return { success: true, message: 'Updated successfully' };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async remove(id: string) {
    try {
      const request = await this.requests.findById(id);
      if (!request)
        throw new NotFoundException({ success: false, message: 'Not found' });
      this.editableRequestMonth(request);
      await this.validatePastEntries([], id);
      await this.entries.deleteMany({ request_id: id });
      if (request.status === 'approved') {
        await this.attendance.deleteMany({
          employee_id: request.employee_id,
          source: 'schedule',
          schedule_request_id: request._id,
        });
      }
      await request.deleteOne();
      return { success: true, message: 'Deleted successfully' };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async getPending(
    query: Record<string, string>,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = {
        status: 'pending',
        ...this.requestPeriodFilter(query),
      };
      const rows = await this.requests.find(filter).sort({ submitted_at: 1 });
      const data = await this.users.enrichRows(rows, context);
      return { success: true, count: data.length, data };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async getAll(
    query: Record<string, string>,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: any = this.requestPeriodFilter(query);
      if (query.status && query.status !== 'all') filter.status = query.status;
      const rows = await this.requests.find(filter).sort({ week_start: -1 });
      const enriched = await this.users.enrichRows(rows, context);
      const monthEntries = await this.entries.find({
        request_id: { $in: rows.map((row) => row._id) },
      });
      const entriesByRequest = new Map<string, any[]>();
      for (const entry of monthEntries) {
        const key = String(entry.request_id);
        const group = entriesByRequest.get(key) || [];
        group.push(entry);
        entriesByRequest.set(key, group);
      }
      const data = enriched.map((request) => ({
        ...request,
        entries: entriesByRequest.get(String(request._id)) || [],
      }));
      return { success: true, count: data.length, data };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
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
          message: 'Invalid or missing pending request',
        });
      }
      return { success: true, message: 'Approved successfully' };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async reject(
    id: string,
    dto: RejectScheduleRequestDto,
    user: AuthenticatedUser,
  ) {
    try {
      const request = await this.requests.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: 'rejected',
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
          message: 'Invalid or missing pending request',
        });
      }
      return { success: true, message: 'Rejected successfully' };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async bulkApprove(dto: BulkApproveScheduleDto, user: AuthenticatedUser) {
    try {
      if (!Array.isArray(dto.ids) || dto.ids.length === 0) {
        throw new BadRequestException({
          success: false,
          message: 'List ids is required',
        });
      }
      const reviewer = authenticatedUserId(user);
      for (const id of dto.ids) {
        await this.approveAndSyncAttendance(id, reviewer);
      }
      return { success: true, message: 'Bulk approval complete' };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async heatmap(query: Record<string, string>) {
    try {
      const month =
        query.month ?? (!query.week ? vietnamDateKey().slice(0, 7) : undefined);
      const range = month ? scheduleMonthRange(month) : null;
      const requests = await this.requests
        .find({
          ...this.requestPeriodFilter({
            ...query,
            ...(month ? { month } : {}),
          }),
          status: 'approved',
        })
        .select('_id');
      const pipeline: PipelineStage[] = [
        {
          $match: {
            request_id: { $in: requests.map((request) => request._id) },
            ...(range ? { date: { $gte: range.start, $lt: range.end } } : {}),
          },
        },
        {
          $group: { _id: { date: '$date', type: '$type' }, count: { $sum: 1 } },
        },
        {
          $group: {
            _id: '$_id.date',
            stats: { $push: { type: '$_id.type', count: '$count' } },
          },
        },
        { $sort: { _id: 1 } },
      ];
      return { success: true, data: await this.entries.aggregate(pipeline) };
    } catch (error) {
      this.rethrowOrFail(error, 'Server Error');
    }
  }

  async monthlyOverview(month: string, user: AuthenticatedUser) {
    try {
      const range = scheduleMonthRange(month);
      if (!range) {
        throw new BadRequestException({
          success: false,
          message: 'Tháng cần xem phải có định dạng YYYY-MM.',
        });
      }
      const requests = await this.requests
        .find({ employee_id: authenticatedUserId(user) })
        .select(
          '_id month week_start status submitted_at reviewed_at reject_reason',
        )
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
          month: request?.month,
          request_status: request?.status ?? 'pending',
          reject_reason: request?.reject_reason,
          date: entry.date,
          type: entry.type,
          period: entry.period ?? 'full_day',
          note: entry.note,
        };
      });
      const active = calendarEntries.filter(
        (entry) => entry.request_status !== 'rejected',
      );
      const approved = calendarEntries.filter(
        (entry) => entry.request_status === 'approved',
      );
      const sessions = (rows: any[]) =>
        rows.reduce(
          (sum, entry) =>
            sum + (entry.period === 'full_day' || !entry.period ? 2 : 1),
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
                ['office', 'remote'].includes(entry.type),
              ),
            ),
            approved_sessions: sessions(
              approved.filter((entry) =>
                ['office', 'remote'].includes(entry.type),
              ),
            ),
            office_sessions: sessionsByType(approved, 'office'),
            remote_sessions: sessionsByType(approved, 'remote'),
            leave_sessions: sessionsByType(approved, 'leave'),
            day_off_sessions: sessionsByType(approved, 'day_off'),
            approved_work_days: new Set(
              approved
                .filter((entry) => ['office', 'remote'].includes(entry.type))
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
      this.rethrowOrFail(error, 'Không thể tải lịch làm việc trong tháng.');
    }
  }

  private async approveAndSyncAttendance(
    id: string,
    reviewer: string,
  ): Promise<boolean> {
    let request = await this.requests.findById(id);
    if (!request || !['pending', 'approved'].includes(request.status)) {
      return false;
    }

    if (request.status === 'pending') {
      const transitioned = await this.requests.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: 'approved',
            reviewed_by: reviewer,
            reviewed_at: new Date(),
          },
        },
        { new: true, runValidators: true },
      );
      if (transitioned) {
        request = transitioned;
      } else {
        request = await this.requests.findOne({ _id: id, status: 'approved' });
        if (!request) return false;
      }
    }

    await this.syncScheduleAttendance(request);
    return true;
  }

  private async validateRegistrationPolicy(month: string): Promise<void> {
    const policy = await this.policies.getActivePolicy();
    const now = new Date();
    if (
      policy.locked ||
      now < policy.registration_start ||
      now > policy.registration_end
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Ngoài khoảng thời gian đăng ký lịch làm việc',
      });
    }

    if (policyScheduleMonth(policy) !== month) {
      throw new BadRequestException({
        success: false,
        message: 'Chỉ được đăng ký trong tháng của đợt đăng ký đang mở.',
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
            ...(!entry.note ? { $unset: { note: '' } } : {}),
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
      ? scheduleEntries.filter((entry) => entry.type === 'remote')
      : await this.entries.find({ request_id: request._id, type: 'remote' });

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
                source: 'schedule',
              },
              update: {
                $set: {
                  schedule_type: 'remote',
                  ...(request.month
                    ? { schedule_request_id: request._id }
                    : {}),
                  check_in_at: checkIn,
                  check_out_at: checkOut,
                },
                $setOnInsert: {
                  employee_id: request.employee_id,
                  date: entry.date,
                  source: 'schedule',
                },
              },
              upsert: true,
            },
          };
        }),
      );
    }

    const { start, end } = this.requestDateRange(request);
    await this.attendance.deleteMany({
      employee_id: request.employee_id,
      source: 'schedule',
      schedule_request_id: request.month ? request._id : { $exists: false },
      date: {
        $gte: start,
        $lt: end,
        $nin: remote.map((entry) => entry.date),
      },
    });
  }

  private remoteTimes(date: Date, period: WorkPeriod) {
    if (period === 'morning') {
      return {
        checkIn: atVietnamTime(date, 8, 30),
        checkOut: atVietnamTime(date, 12, 0),
      };
    }
    if (period === 'afternoon') {
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

  private requestPeriodFilter(query: Record<string, string>) {
    if (query.month !== undefined) {
      const range = scheduleMonthRange(query.month);
      if (!range)
        throw new BadRequestException({
          success: false,
          message: 'Tháng cần xem phải có định dạng YYYY-MM.',
        });
      const legacyStart = new Date(range.start);
      legacyStart.setUTCDate(legacyStart.getUTCDate() - 6);
      return {
        $or: [
          { month: query.month },
          {
            month: { $exists: false },
            week_start: { $gte: legacyStart, $lt: range.end },
          },
        ],
      };
    }
    const week =
      typeof query.week === 'string' ? parseIsoWeek(query.week) : null;
    return week ? { week_start: getWeekStartRange(week) } : {};
  }

  private editableRequestMonth(request: any): string {
    if (!scheduleMonthRange(request.month)) {
      throw new BadRequestException({
        success: false,
        message:
          'Lịch tuần cũ chỉ dùng để xem. Hãy tạo đăng ký theo tháng cho các ngày mới.',
      });
    }
    return request.month;
  }

  private requestDateRange(request: any) {
    const range = scheduleMonthRange(request.month);
    if (range) return range;
    const start = new Date(request.week_start);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  private async validatePastEntries(
    replacement: NormalizedScheduleEntry[],
    requestId?: string,
  ) {
    const today = vietnamDateKey();
    const current = requestId
      ? await this.entries.find({ request_id: requestId })
      : [];
    const previous = new Map<string, any>(
      current.map((entry) => [
        new Date(entry.date).toISOString().slice(0, 10),
        entry,
      ]),
    );
    const next = new Map(
      replacement.map((entry) => [
        entry.date.toISOString().slice(0, 10),
        entry,
      ]),
    );
    for (const date of new Set([...previous.keys(), ...next.keys()])) {
      if (date >= today) continue;
      const before = previous.get(date);
      const after = next.get(date);
      if (
        !before ||
        !after ||
        before.type !== after.type ||
        (before.period ?? 'full_day') !== after.period ||
        (before.note ?? '').trim() !== (after.note ?? '')
      ) {
        throw new BadRequestException({
          success: false,
          message: `Không được thêm, sửa hoặc xóa lịch của ngày đã qua (${date}).`,
        });
      }
    }
  }

  private async validateLegacyOverlap(
    employeeId: string,
    replacement: NormalizedScheduleEntry[],
  ) {
    const legacy = await this.requests
      .find({
        employee_id: employeeId,
        month: { $exists: false },
        status: { $in: ['pending', 'approved'] },
      })
      .select('_id');
    if (legacy.length === 0) return;
    const overlap = await this.entries.findOne({
      request_id: { $in: legacy.map((request) => request._id) },
      date: { $in: replacement.map((entry) => entry.date) },
    });
    if (overlap)
      throw new BadRequestException({
        success: false,
        message:
          'Có ngày đã được đăng ký trong lịch tuần cũ. Vui lòng bỏ ngày trùng trước khi gửi lịch tháng.',
      });
  }

  private rethrowOrFail(error: unknown, message: string): never {
    if (error instanceof HttpException) throw error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Bạn đã có đăng ký trong tháng này. Vui lòng tải lại lịch.',
      });
    }
    throw new HttpException(
      { success: false, message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
