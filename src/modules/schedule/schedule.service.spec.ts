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
