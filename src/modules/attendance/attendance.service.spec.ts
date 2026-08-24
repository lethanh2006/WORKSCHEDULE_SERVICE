import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AttendanceService } from "./attendance.service";

describe("AttendanceService - consume QR sau khi kiểm tra điều kiện", () => {
  const user: AuthenticatedUser = {
    _id: "507f1f77bcf86cd799439011",
    role: "employee",
  };
  const tokenId = "507f1f77bcf86cd799439012";
  const requestId = "507f1f77bcf86cd799439013";

  function createService(options?: {
    office?: object | null;
    record?: object | null;
    consumed?: object | null;
  }) {
    const candidate = { _id: tokenId, token: "valid-token" };
    const tokens = {
      findOne: jest.fn().mockResolvedValue(candidate),
      findOneAndUpdate: jest
        .fn()
        .mockResolvedValue(
          options?.consumed === undefined ? candidate : options.consumed,
        ),
    };
    const createdRecord = { _id: "attendance-id" };
    const attendance = {
      findOne: jest.fn().mockResolvedValue(options?.record ?? null),
      create: jest.fn().mockResolvedValue(createdRecord),
    };
    const entries = {
      findOne: jest
        .fn()
        .mockResolvedValue(options?.office === undefined ? {} : options.office),
    };
    const requests = {
      find: jest.fn().mockResolvedValue([{ _id: requestId }]),
    };
    const service = new AttendanceService(
      tokens as any,
      attendance as any,
      entries as any,
      requests as any,
      {} as any,
    );

    return {
      service,
      tokens,
      attendance,
      entries,
      requests,
      candidate,
      createdRecord,
    };
  }

  it("không consume token khi nhân viên không có lịch văn phòng được duyệt", async () => {
    const { service, tokens, attendance } = createService({ office: null });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(tokens.findOneAndUpdate).not.toHaveBeenCalled();
    expect(attendance.findOne).not.toHaveBeenCalled();
  });

  it("không consume token khi nhân viên đã check-out", async () => {
    const { service, tokens } = createService({
      record: { check_out_at: new Date() },
    });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(tokens.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("consume bằng điều kiện atomic sau eligibility rồi mới tạo check-in", async () => {
    const { service, tokens, attendance, entries, candidate, createdRecord } =
      createService();

    await expect(service.scan({ token: "valid-token" }, user)).resolves.toEqual(
      {
        success: true,
        message: "Check-in thành công",
        data: createdRecord,
      },
    );

    expect(tokens.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: candidate._id,
        token: "valid-token",
        used: false,
        expires_at: { $gt: expect.any(Date) },
      },
      {
        $set: {
          used: true,
          used_by: user._id,
          used_at: expect.any(Date),
        },
      },
      { new: true },
    );
    expect(entries.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      tokens.findOneAndUpdate.mock.invocationCallOrder[0],
    );
    expect(attendance.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      tokens.findOneAndUpdate.mock.invocationCallOrder[0],
    );
    expect(tokens.findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      attendance.create.mock.invocationCallOrder[0],
    );
  });

  it("không ghi điểm danh nếu token bị consume bởi request cạnh tranh", async () => {
    const { service, tokens, attendance } = createService({ consumed: null });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(tokens.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(attendance.create).not.toHaveBeenCalled();
  });
});
