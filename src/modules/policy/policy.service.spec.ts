import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  WORK_POLICY_SINGLETON_KEY,
  type WorkPolicyDocument,
} from '../../schemas/work-policy.schema';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  const user: AuthenticatedUser = {
    _id: '507f1f77bcf86cd799439011',
    role: 'admin',
  };

  function modelWith(overrides: Record<string, jest.Mock> = {}) {
    return {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      ...overrides,
    } as unknown as Model<WorkPolicyDocument>;
  }

  it('nhận một policy cũ làm singleton thay vì tạo policy mặc định mới', async () => {
    const legacy = {
      singleton_key: WORK_POLICY_SINGLETON_KEY,
      registration_start: new Date('2026-08-01T00:00:00.000Z'),
      registration_end: new Date('2026-09-01T00:00:00.000Z'),
      locked: false,
    } as unknown as WorkPolicyDocument;
    const findOne = jest.fn().mockResolvedValue(null);
    const findOneAndUpdate = jest.fn().mockResolvedValue(legacy);
    const service = new PolicyService(modelWith({ findOne, findOneAndUpdate }));

    const result = await service.getActivePolicy();

    expect(result).toBe(legacy);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { singleton_key: { $exists: false } },
      { $set: { singleton_key: WORK_POLICY_SINGLETON_KEY } },
      { new: true },
    );
  });

  it('tạo atomic policy singleton ở trạng thái khóa khi chưa có dữ liệu', async () => {
    const created = {
      singleton_key: WORK_POLICY_SINGLETON_KEY,
      locked: true,
    } as WorkPolicyDocument;
    const findOneAndUpdate = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    const service = new PolicyService(
      modelWith({
        findOne: jest.fn().mockResolvedValue(null),
        findOneAndUpdate,
      }),
    );

    await expect(service.getActivePolicy()).resolves.toBe(created);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { singleton_key: WORK_POLICY_SINGLETON_KEY },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ locked: true }),
      }),
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  it('từ chối cửa sổ đăng ký có thời gian kết thúc không hợp lệ', async () => {
    const current = {
      _id: 'policy-id',
      singleton_key: WORK_POLICY_SINGLETON_KEY,
      registration_start: new Date('2026-08-01T00:00:00.000Z'),
      registration_end: new Date('2026-09-01T00:00:00.000Z'),
      locked: false,
    } as unknown as WorkPolicyDocument;
    const findOneAndUpdate = jest.fn();
    const service = new PolicyService(
      modelWith({
        findOne: jest.fn().mockResolvedValue(current),
        findOneAndUpdate,
      }),
    );

    await expect(
      service.updatePolicy(
        {
          registration_start: '2026-09-02T00:00:00.000Z',
          registration_end: '2026-09-01T00:00:00.000Z',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('ghi cả hai đầu cửa sổ trong cùng một atomic update', async () => {
    const current = {
      _id: 'policy-id',
      singleton_key: WORK_POLICY_SINGLETON_KEY,
      registration_start: new Date('2026-08-01T00:00:00.000Z'),
      registration_end: new Date('2026-09-01T00:00:00.000Z'),
      locked: false,
    } as unknown as WorkPolicyDocument;
    const updated = { ...current, locked: true } as WorkPolicyDocument;
    const findOneAndUpdate = jest.fn().mockResolvedValue(updated);
    const service = new PolicyService(
      modelWith({
        findOne: jest.fn().mockResolvedValue(current),
        findOneAndUpdate,
      }),
    );

    await expect(service.updatePolicy({ locked: true }, user)).resolves.toEqual(
      { success: true, data: { ...updated, schedule_month: null } },
    );
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: current._id, singleton_key: WORK_POLICY_SINGLETON_KEY },
      {
        $set: expect.objectContaining({
          registration_start: current.registration_start,
          registration_end: current.registration_end,
          locked: true,
          updated_by: user._id,
        }),
      },
      { new: true, runValidators: true },
    );
  });
});
