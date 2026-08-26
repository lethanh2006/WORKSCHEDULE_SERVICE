import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { UserClientService } from './user-client.service';

describe('Workschedule UserClientService', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();
  const userInternalSecret = '0123456789abcdef0123456789abcdef';
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'USER_SERVICE_URL') return 'http://user:5000/';
      if (key === 'USER_INTERNAL_SECRET') return userInternalSecret;
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeAll(() => {
    globalThis.fetch = fetchMock;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ký payload khi lấy danh bạ nhân viên', async () => {
    const timestamp = 1_700_000_000_000;
    const userPayload = Buffer.from(
      JSON.stringify({ _id: 'manager-id', role: 'manager' }),
    ).toString('base64');
    jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        users: [{ _id: 'employee-id', username: 'Nguyễn An' }],
      }),
    });
    const service = new UserClientService(config);

    await expect(
      service.enrichRows([{ _id: 'schedule-id', employee_id: 'employee-id' }], {
        requestId: 'req-directory',
        userPayload,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        employee: { _id: 'employee-id', username: 'Nguyễn An' },
      }),
    ]);

    const expectedSignature = createHmac('sha256', userInternalSecret)
      .update(
        `${timestamp}.req-directory.${userPayload}.GET:/api/user/user/all`,
      )
      .digest('hex');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://user:5000/api/user/user/all',
      {
        headers: {
          'x-request-id': 'req-directory',
          'x-user-payload': userPayload,
          'x-user-timestamp': String(timestamp),
          'x-user-signature': expectedSignature,
        },
      },
    );
  });

  it('không gọi danh bạ khi request không có identity', async () => {
    const service = new UserClientService(config);

    await expect(
      service.enrichRows([{ employee_id: 'employee-id' }], {
        requestId: 'req-missing-user',
      }),
    ).resolves.toEqual([{ employee_id: 'employee-id', employee: null }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dừng khởi động khi secret gọi User không an toàn', () => {
    const unsafeConfig = {
      get: jest.fn((key: string) =>
        key === 'USER_INTERNAL_SECRET' ? 'too-short' : undefined,
      ),
    } as unknown as ConfigService;

    expect(() => new UserClientService(unsafeConfig)).toThrow(
      'USER_INTERNAL_SECRET phải có ít nhất 32 byte',
    );
  });
});
