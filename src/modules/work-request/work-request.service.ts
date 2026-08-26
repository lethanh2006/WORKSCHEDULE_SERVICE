import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from '../../common/interfaces/authenticated-user.interface';
import type { ForwardedRequestContext } from '../../common/utils/request.util';
import { WorkRequest } from '../../schemas/work-request.schema';
import { normalizeWorkRequest } from '../../services/workRequestValidator';
import { UserClientService } from '../user-client/user-client.service';
import {
  CreateWorkRequestDto,
  RejectWorkRequestDto,
} from './dto/work-request.dto';

@Injectable()
export class WorkRequestService {
  constructor(
    @InjectModel(WorkRequest.name) private readonly requests: Model<any>,
    private readonly users: UserClientService,
  ) {}

  async create(dto: CreateWorkRequestDto, user: AuthenticatedUser) {
    try {
      const normalized = normalizeWorkRequest(
        dto as unknown as Record<string, unknown>,
      );
      if (!normalized.data) {
        throw new BadRequestException({
          success: false,
          message: normalized.message,
        });
      }
      const employeeId = authenticatedUserId(user);
      const duplicate = await this.requests.findOne({
        employee_id: employeeId,
        type: normalized.data.type,
        start_at: normalized.data.start_at,
        status: { $in: ['pending', 'approved'] },
      });
      if (duplicate) {
        throw new ConflictException({
          success: false,
          message: 'Bạn đã có một đơn cùng loại vào thời gian này.',
        });
      }
      const request = await this.requests.create({
        employee_id: employeeId,
        ...normalized.data,
      });
      return { success: true, data: request };
    } catch (error) {
      this.rethrowOrFail(error, 'Không thể tạo đơn.');
    }
  }

  async getMine(query: Record<string, string>, user: AuthenticatedUser) {
    try {
      const filter: Record<string, any> = {
        employee_id: authenticatedUserId(user),
      };
      const month = this.monthRange(query.month);
      if (query.month && !month) {
        throw new BadRequestException({
          success: false,
          message: 'Tháng cần xem phải có định dạng YYYY-MM.',
        });
      }
      if (month) filter.start_at = month;
      if (query.type && query.type !== 'all') filter.type = query.type;
      if (query.status && query.status !== 'all') filter.status = query.status;
      const data = await this.requests.find(filter).sort({ createdAt: -1 });
      return { success: true, count: data.length, data };
    } catch (error) {
      this.rethrowOrFail(error, 'Không thể tải lịch sử đơn.');
    }
  }

  async stats(monthValue: string, user: AuthenticatedUser) {
    try {
      const filter: Record<string, any> = {
        employee_id: authenticatedUserId(user),
      };
      const month = this.monthRange(monthValue);
      if (monthValue && !month) {
        throw new BadRequestException({
          success: false,
          message: 'Tháng cần xem phải có định dạng YYYY-MM.',
        });
      }
      if (month) filter.start_at = month;
      const rows = await this.requests
        .find(filter)
        .select('type status start_at end_at period')
        .lean();
      const byType: Record<string, number> = {};
      const approvedByType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let overtime = 0;
      rows.forEach((row) => {
        byType[row.type] = (byType[row.type] ?? 0) + 1;
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
        if (row.status === 'approved') {
          approvedByType[row.type] = (approvedByType[row.type] ?? 0) + 1;
        }
        if (
          row.type === 'overtime' &&
          row.status === 'approved' &&
          row.end_at
        ) {
          overtime +=
            (new Date(row.end_at).getTime() -
              new Date(row.start_at).getTime()) /
            3_600_000;
        }
      });
      return {
        success: true,
        data: {
          total: rows.length,
          pending: byStatus.pending ?? 0,
          approved: byStatus.approved ?? 0,
          rejected: byStatus.rejected ?? 0,
          cancelled: byStatus.cancelled ?? 0,
          approved_overtime_hours: Math.round(overtime * 10) / 10,
          by_type: byType,
          approved_by_type: approvedByType,
        },
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Không thể tải thống kê đơn.');
    }
  }

  async cancel(id: string, user: AuthenticatedUser) {
    try {
      const request = await this.requests.findOne({
        _id: id,
        employee_id: authenticatedUserId(user),
      });
      if (!request) {
        throw new NotFoundException({
          success: false,
          message: 'Không tìm thấy đơn.',
        });
      }
      if (request.status !== 'pending') {
        throw new BadRequestException({
          success: false,
          message: 'Chỉ có thể hủy đơn đang chờ duyệt.',
        });
      }
      request.status = 'cancelled';
      await request.save();
      return { success: true, data: request };
    } catch (error) {
      this.rethrowOrFail(error, 'Không thể hủy đơn.');
    }
  }

  async getAdmin(
    query: Record<string, string>,
    context: ForwardedRequestContext,
  ) {
    try {
      const filter: Record<string, any> = {};
      if (query.type && query.type !== 'all') filter.type = query.type;
      if (query.status && query.status !== 'all') filter.status = query.status;
      const month = this.monthRange(query.month);
      if (month) filter.start_at = month;
      const rows = await this.requests.find(filter).sort({ createdAt: -1 });
      const data = await this.users.enrichRows(rows, context);
      return { success: true, count: data.length, data };
    } catch (error) {
      this.rethrowOrFail(error, 'Không thể tải danh sách đơn.');
    }
  }

  approve(id: string, user: AuthenticatedUser) {
    return this.review(id, undefined, user, 'approved');
  }

  reject(id: string, dto: RejectWorkRequestDto, user: AuthenticatedUser) {
    return this.review(id, dto, user, 'rejected');
  }

  private async review(
    id: string,
    dto: RejectWorkRequestDto | undefined,
    user: AuthenticatedUser,
    status: 'approved' | 'rejected',
  ) {
    try {
      const request = await this.requests.findById(id);
      if (!request || request.status !== 'pending') {
        throw new BadRequestException({
          success: false,
          message: 'Đơn không tồn tại hoặc đã được xử lý.',
        });
      }
      const reason = dto?.reason?.trim() ?? '';
      if (status === 'rejected' && !reason) {
        throw new BadRequestException({
          success: false,
          message: 'Vui lòng nhập lý do từ chối.',
        });
      }
      request.status = status;
      request.reviewed_by = authenticatedUserId(user);
      request.reviewed_at = new Date();
      request.reject_reason = status === 'rejected' ? reason : undefined;
      await request.save();
      return { success: true, data: request };
    } catch (error) {
      this.rethrowOrFail(
        error,
        status === 'approved'
          ? 'Không thể duyệt đơn.'
          : 'Không thể từ chối đơn.',
      );
    }
  }

  private monthRange(value: unknown) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    return {
      $gte: new Date(Date.UTC(year, month, 1)),
      $lt: new Date(Date.UTC(year, month + 1, 1)),
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
