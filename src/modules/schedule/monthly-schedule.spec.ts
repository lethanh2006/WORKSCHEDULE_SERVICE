import { BadRequestException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { normalizeScheduleEntries } from './utils/schedule-entry-validator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

const employee: AuthenticatedUser = {
  _id: '507f1f77bcf86cd799439011',
  role: 'user',
};
const day = (date: string) => ({
  date,
  type: 'office' as const,
  period: 'full_day' as const,
  note: '',
});
const policy = {
  registration_start: new Date('2026-10-01T00:00:00+07:00'),
  registration_end: new Date('2026-10-31T23:59:59+07:00'),
  locked: false,
};

function harness(existingEntries: object[] = []) {
  const save = jest.fn().mockResolvedValue({});
  const requests: any = jest.fn().mockImplementation((data: object) => ({
    ...data,
    _id: 'monthly-id',
    save,
  }));
  requests.findOne = jest.fn().mockResolvedValue(null);
  requests.find = jest
    .fn()
    .mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  requests.findById = jest.fn().mockResolvedValue({
    _id: 'monthly-id',
    employee_id: employee._id,
    month: '2026-10',
    status: 'pending',
  });
  requests.findOneAndUpdate = jest
    .fn()
    .mockResolvedValue({ _id: 'monthly-id', status: 'pending' });
  const entries = {
    find: jest.fn().mockResolvedValue(existingEntries),
    findOne: jest.fn().mockResolvedValue(null),
    insertMany: jest.fn().mockResolvedValue([]),
    bulkWrite: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  };
  const policies = { getActivePolicy: jest.fn().mockResolvedValue(policy) };
  const service = new ScheduleService(
    requests,
    entries as any,
    {} as any,
    {} as any,
    policies as any,
  );
  return { service, requests, entries, policies, save };
}

describe('Lịch tháng - phạm vi và ngày Việt Nam', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T03:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('tạo đủ 31 ngày trong một yêu cầu tháng', async () => {
    const { service, entries, save } = harness();
    const result = await service.create(
      {
        month: '2026-10',
        entries: Array.from({ length: 31 }, (_, i) =>
          day(`2026-10-${String(i + 1).padStart(2, '0')}`),
        ),
      },
      employee,
    );
    expect(result.data.month).toBe('2026-10');
    expect(entries.insertMany.mock.calls[0][0]).toHaveLength(31);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it.each(['user', 'admin'])(
    'vai trò %s không vượt policy đang khóa hoặc tháng đang mở',
    async (role) => {
      const { service, policies, entries } = harness();
      await expect(
        service.create(
          { month: '2026-11', entries: [day('2026-11-01')] },
          { ...employee, role },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      policies.getActivePolicy.mockResolvedValue({ ...policy, locked: true });
      await expect(
        service.create(
          { month: '2026-10', entries: [day('2026-10-01')] },
          { ...employee, role },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(entries.insertMany).not.toHaveBeenCalled();
    },
  );

  it('không tạo trùng yêu cầu tháng', async () => {
    const { service, requests, entries } = harness();
    requests.findOne.mockResolvedValue({ _id: 'existing' });
    await expect(
      service.create(
        { month: '2026-10', entries: [day('2026-10-01')] },
        employee,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entries.insertMany).not.toHaveBeenCalled();
  });

  it('không đăng ký chồng ngày thuộc lịch tuần cũ', async () => {
    const { service, requests, entries } = harness();
    requests.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'legacy-id' }]),
    });
    entries.findOne.mockResolvedValue({ date: '2026-10-01' });
    await expect(
      service.create(
        { month: '2026-10', entries: [day('2026-10-01')] },
        employee,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entries.insertMany).not.toHaveBeenCalled();
  });

  it('khóa ngày hôm qua ngay lúc qua 00:00 Việt Nam dù UTC chưa đổi ngày', async () => {
    jest.setSystemTime(new Date('2026-10-01T17:00:00Z'));
    const { service, entries } = harness();
    await expect(
      service.create(
        { month: '2026-10', entries: [day('2026-10-01')] },
        employee,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entries.insertMany).not.toHaveBeenCalled();
    await expect(
      service.create(
        { month: '2026-10', entries: [day('2026-10-02')] },
        employee,
      ),
    ).resolves.toMatchObject({ success: true });
  });

  it.each(['sửa', 'xóa', 'thêm'])(
    'admin không được %s ngày đã qua',
    async (operation) => {
      jest.setSystemTime(new Date('2026-10-05T03:00:00Z'));
      const { service, entries } = harness(
        operation === 'thêm' ? [] : [day('2026-10-04')],
      );
      const replacement =
        operation === 'xóa'
          ? [day('2026-10-05')]
          : [{ ...day('2026-10-04'), note: 'Thay đổi' }, day('2026-10-05')];
      await expect(
        service.update('monthly-id', { entries: replacement }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(entries.bulkWrite).not.toHaveBeenCalled();
      expect(entries.deleteMany).not.toHaveBeenCalled();
    },
  );

  it('gửi lại giữ nguyên ngày quá khứ và cho sửa ngày còn lại', async () => {
    jest.setSystemTime(new Date('2026-10-05T03:00:00Z'));
    const { service, requests, entries } = harness([day('2026-10-04')]);
    requests.findOne.mockResolvedValue({
      _id: 'monthly-id',
      month: '2026-10',
      employee_id: employee._id,
      status: 'rejected',
    });
    await expect(
      service.resubmit(
        'monthly-id',
        { entries: [day('2026-10-04'), day('2026-10-05')] },
        employee,
      ),
    ).resolves.toMatchObject({ success: true });
    expect(entries.bulkWrite).toHaveBeenCalledTimes(1);
  });

  it('không xóa cả yêu cầu khi có ngày quá khứ', async () => {
    jest.setSystemTime(new Date('2026-10-05T03:00:00Z'));
    const { service, entries } = harness([day('2026-10-04')]);
    await expect(service.remove('monthly-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(entries.deleteMany).not.toHaveBeenCalled();
  });

  it('từ chối ngày khác tháng, ngày trùng, ngày không tồn tại và tháng sai định dạng', () => {
    for (const [month, entries] of [
      ['2026-10', [day('2026-10-29'), day('2026-11-02')]],
      ['2026-10', [day('2026-10-01'), day('2026-10-01')]],
      ['2026-02', [day('2026-02-29')]],
      ['2026-13', [day('2026-12-01')]],
    ] as const)
      expect(normalizeScheduleEntries(entries, month).entries).toBeUndefined();
    expect(
      normalizeScheduleEntries([day('2028-02-29')], '2028-02').entries,
    ).toHaveLength(1);
  });

  it('di chuyển index vẫn khởi động được khi replica khác đã xóa index tuần', async () => {
    const { service, requests } = harness();
    requests.collection = {
      createIndex: jest.fn().mockResolvedValue('employee_id_1_month_1'),
      indexes: jest
        .fn()
        .mockResolvedValue([{ name: 'employee_id_1_week_start_1' }]),
      dropIndex: jest.fn().mockRejectedValue({ code: 27 }),
    };
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(
      requests.collection.createIndex.mock.invocationCallOrder[0],
    ).toBeLessThan(requests.collection.dropIndex.mock.invocationCallOrder[0]);
  });
  it('danh sách tháng trả entry của từng nhân viên cho bảng lịch admin', async () => {
    const requests = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]),
      }),
    };
    const entries = {
      find: jest
        .fn()
        .mockResolvedValue([{ ...day('2026-10-07'), request_id: 'b' }]),
    };
    const users = {
      enrichRows: jest.fn().mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]),
    };
    const service = new ScheduleService(
      requests as any,
      entries as any,
      {} as any,
      users as any,
      {} as any,
    );
    const result = await service.getAll({ month: '2026-10' }, {} as any);
    expect(result.data[0].entries).toEqual([]);
    expect(result.data[1].entries).toEqual([
      { ...day('2026-10-07'), request_id: 'b' },
    ]);
    expect(requests.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([{ month: '2026-10' }]),
      }),
    );
  });
});
