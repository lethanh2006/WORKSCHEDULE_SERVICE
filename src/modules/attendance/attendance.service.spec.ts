import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AttendanceService } from "./attendance.service";

describe("AttendanceService - QR dùng chung theo từng nhân viên", () => {
  const user: AuthenticatedUser = {
    _id: "507f1f77bcf86cd799439011",
    role: "employee",
  };
  const tokenId = "507f1f77bcf86cd799439012";
  const requestId = "507f1f77bcf86cd799439013";

  function createService(options?: {
    office?: object | null;
    record?: object | null;
    write?: object | null;
    writeError?: unknown;
  }) {
    const candidate = { _id: tokenId, token: "valid-token" };
    const tokens = {
      findOne: jest.fn().mockResolvedValue(candidate),
    };
    const createdRecord = {
      _id: "attendance-id",
      check_in_token_id: tokenId,
    };
    const writeResult =
      options?.write === undefined ? createdRecord : options.write;
    const attendance = {
      findOne: jest.fn().mockResolvedValue(options?.record ?? null),
      findOneAndUpdate: options?.writeError
        ? jest
            .fn()
            .mockRejectedValueOnce(options.writeError)
            .mockResolvedValueOnce(writeResult)
        : jest.fn().mockResolvedValue(writeResult),
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

  it("không ghi chấm công khi nhân viên không có lịch văn phòng được duyệt", async () => {
    const { service, tokens, attendance } = createService({ office: null });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(tokens.findOne).toHaveBeenCalledTimes(1);
    expect(attendance.findOne).not.toHaveBeenCalled();
  });

  it("không ghi thêm khi nhân viên đã check-out", async () => {
    const { service, tokens } = createService({
      record: { check_out_at: new Date() },
    });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(tokens.findOne).toHaveBeenCalledTimes(1);
  });

  it("ghi check-in nguyên tử mà không đánh dấu token dùng toàn cục", async () => {
    const { service, tokens, attendance, entries, candidate, createdRecord } =
      createService();

    await expect(service.scan({ token: "valid-token" }, user)).resolves.toEqual(
      {
        success: true,
        message: "Check-in thành công",
        data: createdRecord,
      },
    );

    expect(tokens.findOne).toHaveBeenCalledWith({
      token: "valid-token",
      date: expect.any(Date),
      expires_at: { $gt: expect.any(Date) },
    });
    expect(attendance.findOneAndUpdate).toHaveBeenCalledWith(
      {
        employee_id: user._id,
        date: expect.any(Date),
        source: "qr",
        check_in_at: { $exists: false },
        check_in_token_id: { $ne: candidate._id },
        check_out_at: { $exists: false },
        check_out_token_id: { $ne: candidate._id },
      },
      {
        $set: {
          schedule_type: "office",
          check_in_at: expect.any(Date),
          check_in_token_id: candidate._id,
        },
        $setOnInsert: {
          employee_id: user._id,
          date: expect.any(Date),
          source: "qr",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    expect(entries.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      attendance.findOneAndUpdate.mock.invocationCallOrder[0],
    );
    expect(attendance.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      attendance.findOneAndUpdate.mock.invocationCallOrder[0],
    );
  });

  it("cho hai nhân viên dùng chung một token để check-in", async () => {
    const { service, tokens, attendance } = createService();
    const anotherUser: AuthenticatedUser = {
      _id: "507f1f77bcf86cd799439099",
      role: "employee",
    };

    await expect(service.scan({ token: "valid-token" }, user)).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    await expect(
      service.scan({ token: "valid-token" }, anotherUser),
    ).resolves.toEqual(expect.objectContaining({ success: true }));

    expect(tokens.findOne).toHaveBeenCalledTimes(2);
    expect(attendance.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ employee_id: anotherUser._id }),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("không cho một nhân viên dùng lại cùng token để check-out", async () => {
    const { service, attendance } = createService({
      record: {
        _id: "attendance-id",
        check_in_at: new Date(),
        check_in_token_id: tokenId,
      },
    });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("lỗi ghi chấm công không làm mất token và có thể thử lại", async () => {
    const { service, tokens, attendance } = createService({
      writeError: new Error("mongo error"),
    });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 500 });
    await expect(service.scan({ token: "valid-token" }, user)).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );

    expect(tokens.findOne).toHaveBeenCalledTimes(2);
    expect(attendance.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("trả lỗi nghiệp vụ khi hai request check-in cạnh tranh", async () => {
    const duplicateKeyError = Object.assign(new Error("duplicate key"), {
      code: 11000,
    });
    const { service, attendance } = createService({
      writeError: duplicateKeyError,
    });

    await expect(
      service.scan({ token: "valid-token" }, user),
    ).rejects.toMatchObject({ status: 400 });
    expect(attendance.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
