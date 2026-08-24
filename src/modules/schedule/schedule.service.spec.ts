import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { ScheduleService } from "./schedule.service";

describe("ScheduleService - thay thế lịch", () => {
  const requestId = "507f1f77bcf86cd799439011";
  const weekStart = new Date("2026-08-24T00:00:00.000Z");
  const dto = {
    entries: [
      {
        date: "2026-08-24T00:00:00.000Z",
        type: "office" as const,
        period: "full_day" as const,
        note: "Họp nhóm",
      },
      {
        date: "2026-08-25T00:00:00.000Z",
        type: "remote" as const,
        period: "morning" as const,
      },
    ],
  };

  function createService(entries: Record<string, jest.Mock>) {
    const requests = {
      findById: jest.fn().mockResolvedValue({
        _id: requestId,
        week_start: weekStart,
        status: "pending",
      }),
    };

    return new ScheduleService(
      requests as any,
      entries as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it("upsert toàn bộ lịch mới trước khi xóa các ngày không còn dùng", async () => {
    const bulkWrite = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const service = createService({ bulkWrite, deleteMany });

    await expect(service.update(requestId, dto)).resolves.toEqual({
      success: true,
      message: "Updated successfully",
    });

    expect(bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: {
            request_id: requestId,
            date: new Date(dto.entries[0].date),
          },
          update: {
            $set: {
              type: "office",
              period: "full_day",
              note: "Họp nhóm",
            },
            $setOnInsert: {
              request_id: requestId,
              date: new Date(dto.entries[0].date),
            },
          },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: {
            request_id: requestId,
            date: new Date(dto.entries[1].date),
          },
          update: {
            $set: { type: "remote", period: "morning" },
            $setOnInsert: {
              request_id: requestId,
              date: new Date(dto.entries[1].date),
            },
            $unset: { note: "" },
          },
          upsert: true,
        },
      },
    ]);
    expect(deleteMany).toHaveBeenCalledWith({
      request_id: requestId,
      date: {
        $nin: dto.entries.map((entry) => new Date(entry.date)),
      },
    });
    expect(bulkWrite.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMany.mock.invocationCallOrder[0],
    );
  });

  it("không xóa lịch cũ nếu bước upsert lịch mới thất bại", async () => {
    const bulkWrite = jest.fn().mockRejectedValue(new Error("mongo error"));
    const deleteMany = jest.fn();
    const service = createService({ bulkWrite, deleteMany });

    await expect(service.update(requestId, dto)).rejects.toMatchObject({
      status: 500,
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("ScheduleService - duyệt lịch và đồng bộ chấm công", () => {
  const requestId = "507f1f77bcf86cd799439011";
  const employeeId = "507f1f77bcf86cd799439012";
  const admin: AuthenticatedUser = {
    _id: "507f1f77bcf86cd799439013",
    role: "admin",
  };
  const weekStart = new Date("2026-08-24T00:00:00.000Z");
  const remoteDate = new Date("2026-08-25T00:00:00.000Z");

  function createApprovalService(options?: {
    initialStatus?: "pending" | "approved";
    bulkWrite?: jest.Mock;
  }) {
    const request = {
      _id: requestId,
      employee_id: employeeId,
      week_start: weekStart,
      status: options?.initialStatus ?? "pending",
    };
    const approved = { ...request, status: "approved" };
    const requests = {
      findById: jest.fn().mockResolvedValue(request),
      findOneAndUpdate: jest.fn().mockResolvedValue(approved),
      findOne: jest.fn().mockResolvedValue(approved),
    };
    const entries = {
      find: jest
        .fn()
        .mockResolvedValue([
          { date: remoteDate, type: "remote", period: "morning" },
        ]),
    };
    const attendance = {
      bulkWrite: options?.bulkWrite ?? jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    const service = new ScheduleService(
      requests as any,
      entries as any,
      attendance as any,
      {} as any,
      {} as any,
    );

    return { service, requests, entries, attendance };
  }

  it("chuyển trạng thái pending bằng điều kiện atomic rồi upsert chấm công", async () => {
    const { service, requests, attendance } = createApprovalService();

    await expect(service.approve(requestId, admin)).resolves.toEqual({
      success: true,
      message: "Approved successfully",
    });

    expect(requests.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: requestId, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewed_by: admin._id,
          reviewed_at: expect.any(Date),
        },
      },
      { new: true, runValidators: true },
    );
    expect(attendance.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: {
            employee_id: employeeId,
            date: remoteDate,
            source: "schedule",
          },
          update: {
            $set: {
              schedule_type: "remote",
              check_in_at: expect.any(Date),
              check_out_at: expect.any(Date),
            },
            $setOnInsert: {
              employee_id: employeeId,
              date: remoteDate,
              source: "schedule",
            },
          },
          upsert: true,
        },
      },
    ]);
    expect(requests.findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      attendance.bulkWrite.mock.invocationCallOrder[0],
    );
  });

  it("retry một lịch đã duyệt để sửa chấm công còn thiếu mà không duyệt lại", async () => {
    const bulkWrite = jest
      .fn()
      .mockRejectedValueOnce(new Error("mongo error"))
      .mockResolvedValueOnce({});
    const { service, requests, attendance } = createApprovalService({
      initialStatus: "approved",
      bulkWrite,
    });

    await expect(service.approve(requestId, admin)).rejects.toMatchObject({
      status: 500,
    });
    await expect(service.approve(requestId, admin)).resolves.toMatchObject({
      success: true,
    });

    expect(requests.findOneAndUpdate).not.toHaveBeenCalled();
    expect(attendance.bulkWrite).toHaveBeenCalledTimes(2);
    expect(attendance.deleteMany).toHaveBeenCalledTimes(1);
  });
});
