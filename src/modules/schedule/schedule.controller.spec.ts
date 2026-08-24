import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import type { RequestWithContext } from "../../common/interfaces/request-context.interface";
import { ScheduleController } from "./schedule.controller";

describe("ScheduleController - gửi lại lịch", () => {
  it("chuyển id, entries và user xác thực xuống service", async () => {
    const result = { success: true };
    const schedules = {
      resubmit: jest.fn().mockResolvedValue(result),
    };
    const controller = new ScheduleController(schedules as any);
    const user: AuthenticatedUser = {
      _id: "507f1f77bcf86cd799439011",
      role: "user",
    };
    const request = { user } as RequestWithContext;
    const dto = {
      entries: [
        {
          date: "2026-08-31T00:00:00.000Z",
          type: "office" as const,
          period: "full_day" as const,
        },
      ],
    };

    await expect(controller.resubmit("request-id", dto, request)).resolves.toBe(
      result,
    );
    expect(schedules.resubmit).toHaveBeenCalledWith("request-id", dto, user);
  });
});
