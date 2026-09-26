import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AttendanceService } from './attendance/attendance.service';
import { WorkRequestService } from './work-request/work-request.service';

describe('Truy vấn dữ liệu nhân sự cá nhân', () => {
  const user: AuthenticatedUser = {
    _id: '507f1f77bcf86cd799439011',
    role: 'employee',
  };

  it('giới hạn và dùng lean khi tải đơn trong tháng', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const service = new WorkRequestService({ find } as any, {} as any);

    await expect(service.getMine({ month: '2026-09' }, user)).resolves.toEqual({
      success: true,
      count: 0,
      data: [],
    });

    expect(find).toHaveBeenCalledWith({
      employee_id: user._id,
      start_at: {
        $gte: new Date('2026-09-01T00:00:00.000Z'),
        $lt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    expect(sort).toHaveBeenCalledWith({ start_at: -1, createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(100);
    expect(lean).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('giới hạn và dùng lean khi tải chấm công theo khoảng ngày', async () => {
    const rows = [{ _id: 'attendance-1', date: new Date('2026-09-26') }];
    const exec = jest.fn().mockResolvedValue(rows);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const service = new AttendanceService(
      {} as any,
      { find } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getMine({ from: '2026-09-01', to: '2026-09-30' }, user),
    ).resolves.toEqual({
      success: true,
      count: 1,
      data: [{ ...rows[0], employee: user }],
    });

    expect(find).toHaveBeenCalledWith({
      employee_id: user._id,
      date: {
        $gte: new Date('2026-09-01'),
        $lte: new Date('2026-09-30'),
      },
    });
    expect(sort).toHaveBeenCalledWith({ date: -1 });
    expect(limit).toHaveBeenCalledWith(100);
    expect(lean).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
