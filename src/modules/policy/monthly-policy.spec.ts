import { BadRequestException } from '@nestjs/common';
import { PolicyService } from './policy.service';
import {
  endOfVietnamMonth,
  policyScheduleMonth,
} from '../../utils/schedule-month';

const admin = { _id: '507f1f77bcf86cd799439011', role: 'admin' };
const current = {
  _id: 'policy-id',
  singleton_key: 'default',
  locked: true,
  registration_start: new Date('2026-10-29T00:00:00+07:00'),
  registration_end: new Date('2026-10-31T23:59:59+07:00'),
};
function setup() {
  const model = {
    findOne: jest.fn().mockResolvedValue(current),
    findOneAndUpdate: jest
      .fn()
      .mockImplementation((_query, update) =>
        Promise.resolve({ ...current, ...update.$set }),
      ),
  };
  return { service: new PolicyService(model as any), model };
}

describe('Đợt đăng ký chỉ trong một tháng', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-29T03:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('từ chối khoảng 29/10–02/11 trước khi ghi dữ liệu', async () => {
    const { service, model } = setup();
    await expect(
      service.updatePolicy(
        {
          registration_start: '2026-10-29T00:00:00+07:00',
          registration_end: '2026-11-02T23:59:59+07:00',
          locked: false,
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('cho mở từ hôm nay đến cuối tháng và suy ra schedule_month', async () => {
    const { service, model } = setup();
    await expect(
      service.updatePolicy(
        {
          registration_start: '2026-10-29T00:00:00+07:00',
          registration_end: '2026-10-31T23:59:59+07:00',
          locked: false,
        },
        admin,
      ),
    ).resolves.toMatchObject({
      data: { schedule_month: '2026-10', locked: false },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('không cho admin chọn ngày mở đã qua', async () => {
    const { service, model } = setup();
    await expect(
      service.updatePolicy(
        { registration_start: '2026-10-28T23:59:59+07:00', locked: false },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('khóa policy cũ vắt tháng khi trả về FE và vẫn cho dừng đợt đó', async () => {
    const { service, model } = setup();
    const legacy = {
      ...current,
      registration_end: new Date('2026-11-02T00:00:00+07:00'),
      locked: false,
    };
    model.findOne.mockResolvedValue(legacy);
    await expect(service.getPolicy()).resolves.toMatchObject({
      data: { schedule_month: null, locked: true },
    });
    await expect(
      service.updatePolicy({ locked: true }, admin),
    ).resolves.toMatchObject({ success: true });
  });

  it('xác định cuối tháng và ranh giới theo múi giờ Việt Nam', () => {
    expect(
      endOfVietnamMonth(new Date('2028-02-01T00:00:00Z')).toISOString(),
    ).toBe('2028-02-29T16:59:59.999Z');
    expect(
      policyScheduleMonth({
        registration_start: new Date('2026-09-30T17:00:00Z'),
        registration_end: new Date('2026-10-31T16:59:59Z'),
      }),
    ).toBe('2026-10');
    expect(
      policyScheduleMonth({
        registration_start: new Date('2026-10-01T00:00:00Z'),
        registration_end: new Date('2026-10-31T17:00:00Z'),
      }),
    ).toBeNull();
  });
});
