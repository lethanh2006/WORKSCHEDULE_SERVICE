import { ScheduleService } from './schedule.service';

describe('Lưu lịch và chấm công trong cùng transaction', () => {
  const employee = { _id: 'employee-id', role: 'user' };
  const admin = { _id: 'admin-id', role: 'admin' };
  const requestId = 'request-id';
  const original = {
    date: new Date('2026-10-06T00:00:00Z'),
    type: 'office',
    period: 'full_day',
  };
  const replacement = {
    entries: [
      {
        date: '2026-10-06',
        type: 'remote' as const,
        period: 'morning' as const,
      },
    ],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T03:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  function harness(status: string, failAt: 'transition' | 'attendance') {
    let committed = {
      request: {
        _id: requestId,
        employee_id: employee._id,
        month: '2026-10',
        status,
      },
      entries: [structuredClone(original)],
    };
    let snapshot: typeof committed | null = null;
    const session = {
      withTransaction: jest.fn(async (action: () => Promise<unknown>) => {
        snapshot = structuredClone(committed);
        try {
          const result = await action();
          committed = snapshot;
          return result;
        } finally {
          snapshot = null;
        }
      }),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const state = (options: { session: unknown }) => {
      expect(options.session).toBe(session);
      if (!snapshot) throw new Error('Ghi dữ liệu ngoài transaction');
      return snapshot;
    };
    const requests = {
      db: { startSession: jest.fn().mockResolvedValue(session) },
      findById: jest.fn(
        (_id: string, _fields: null, options: { session: unknown }) =>
          structuredClone(state(options).request),
      ),
      findOne: jest.fn(
        (_filter: object, _fields: null, options: { session: unknown }) =>
          structuredClone(state(options).request),
      ),
      find: jest.fn(
        (_filter: object, _fields: null, options: { session: unknown }) => {
          state(options);
          return { select: jest.fn().mockResolvedValue([]) };
        },
      ),
      updateOne: jest.fn(
        (_filter: object, _update: object, options: { session: unknown }) => {
          state(options);
          return { modifiedCount: 1 };
        },
      ),
      findOneAndUpdate: jest.fn(
        (
          _filter: object,
          update: { $set?: { status: string } },
          options: { session: unknown },
        ) => {
          const data = state(options);
          if (failAt === 'transition') return null;
          if (update.$set) data.request.status = update.$set.status;
          return structuredClone(data.request);
        },
      ),
    };
    const entries = {
      find: jest.fn(
        (
          filter: { type?: string },
          _fields: null,
          options: { session: unknown },
        ) =>
          structuredClone(
            state(options).entries.filter(
              (entry) => !filter.type || entry.type === filter.type,
            ),
          ),
      ),
      bulkWrite: jest.fn((_writes: unknown, options: { session: unknown }) => {
        state(options).entries = [
          { ...original, type: 'remote', period: 'morning' },
        ];
      }),
      deleteMany: jest.fn((_filter: object, options: { session: unknown }) => {
        state(options);
      }),
    };
    const attendance = {
      bulkWrite: jest.fn((_writes: unknown, options: { session: unknown }) => {
        state(options);
        throw new Error('Mất kết nối khi lưu chấm công');
      }),
      deleteMany: jest.fn((_filter: object, options: { session: unknown }) => {
        state(options);
        throw new Error('Mất kết nối khi lưu chấm công');
      }),
    };
    const policies = {
      getActivePolicy: jest.fn().mockResolvedValue({
        locked: false,
        registration_start: new Date('2026-10-01T00:00:00+07:00'),
        registration_end: new Date('2026-10-31T23:59:59+07:00'),
      }),
    };
    const service = new ScheduleService(
      requests as any,
      entries as any,
      attendance as any,
      {} as any,
      policies as any,
    );
    return { service, session, entries, requests, committed: () => committed };
  }

  it('gửi lại không ghi đè ngày khi điều kiện chuyển rejected sang pending thất bại', async () => {
    const { service, session, entries, committed } = harness(
      'rejected',
      'transition',
    );
    await expect(
      service.resubmit(requestId, replacement, employee),
    ).rejects.toMatchObject({ status: 400 });
    expect(entries.bulkWrite).toHaveBeenCalledTimes(1);
    expect(committed().entries).toEqual([original]);
    expect(committed().request.status).toBe('rejected');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('duyệt lỗi chấm công không để lại trạng thái approved', async () => {
    const { service, session, requests, committed } = harness(
      'pending',
      'attendance',
    );
    await expect(service.approve(requestId, admin)).rejects.toMatchObject({
      status: 500,
    });
    expect(requests.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(committed().request.status).toBe('pending');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('sửa lịch đã duyệt lỗi chấm công giữ nguyên các ngày đã lưu', async () => {
    const { service, session, committed } = harness('approved', 'attendance');
    await expect(service.update(requestId, replacement)).rejects.toMatchObject({
      status: 500,
    });
    expect(committed().entries).toEqual([original]);
    expect(committed().request.status).toBe('approved');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
