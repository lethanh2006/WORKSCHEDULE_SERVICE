import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ForwardedRequestContext } from "../../common/utils/request.util";

@Injectable()
export class UserClientService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>("USER_SERVICE_URL") ?? "http://localhost:5000"
    ).replace(/\/+$/, "");
  }

  async enrichRows(
    rows: any[],
    context: ForwardedRequestContext,
  ): Promise<any[]> {
    if (rows.length === 0) return rows;
    const normalized = rows.map((row) => {
      const value = typeof row?.toObject === "function" ? row.toObject() : row;
      return { ...value, employee: null };
    });
    if (!context.userPayload) return normalized;

    try {
      const response = await fetch(`${this.baseUrl}/api/user/user/all`, {
        headers: {
          "x-user-payload": context.userPayload,
          "x-request-id": context.requestId,
        },
      });
      if (!response.ok) return normalized;
      const payload = (await response.json()) as any;
      const users = Array.isArray(payload?.users)
        ? payload.users
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
      const map = new Map(
        users.map((user: any) => [String(user._id ?? user.id), user]),
      );
      return normalized.map((row) => ({
        ...row,
        employee: map.get(String(row.employee_id)) ?? null,
      }));
    } catch (error) {
      console.error("Error fetching user from user service:", error);
      return normalized;
    }
  }

  async enrichOne(row: any, context: ForwardedRequestContext): Promise<any> {
    const [enriched] = await this.enrichRows([row], context);
    return enriched ?? null;
  }
}
