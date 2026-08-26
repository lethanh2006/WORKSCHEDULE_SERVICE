import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { ForwardedRequestContext } from '../../common/utils/request.util';

const DIRECTORY_PATH = '/api/user/user/all';
const FORBIDDEN_INTERNAL_SECRETS = new Set([
  'replace_with_at_least_32_random_characters',
  'your-super-secret-key-chatapp',
  'your_jwt_secret_here',
]);

@Injectable()
export class UserClientService {
  private readonly logger = new Logger(UserClientService.name);
  private readonly baseUrl: string;
  private readonly userInternalSecret: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('USER_SERVICE_URL') ?? 'http://localhost:5000'
    ).replace(/\/+$/, '');
    this.userInternalSecret = this.requireInternalSecret(
      config.get<string>('USER_INTERNAL_SECRET'),
    );
  }

  async enrichRows(
    rows: any[],
    context: ForwardedRequestContext,
  ): Promise<any[]> {
    if (rows.length === 0) return rows;
    const normalized = rows.map((row) => {
      const value = typeof row?.toObject === 'function' ? row.toObject() : row;
      return { ...value, employee: null };
    });
    if (!context.userPayload) return normalized;

    try {
      const response = await fetch(`${this.baseUrl}${DIRECTORY_PATH}`, {
        headers: this.signedDirectoryHeaders(
          context.userPayload,
          context.requestId,
        ),
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
    } catch (error: unknown) {
      this.logger.warn({
        'event.name': 'user.directory.enrichment.skipped',
        'exception.type': error instanceof Error ? error.name : 'UnknownError',
      });
      return normalized;
    }
  }

  async enrichOne(row: any, context: ForwardedRequestContext): Promise<any> {
    const [enriched] = await this.enrichRows([row], context);
    return enriched ?? null;
  }

  private requireInternalSecret(value: string | undefined): string {
    const secret = value?.trim();
    if (
      !secret ||
      Buffer.byteLength(secret) < 32 ||
      FORBIDDEN_INTERNAL_SECRETS.has(secret.toLowerCase())
    ) {
      throw new Error('USER_INTERNAL_SECRET phải có ít nhất 32 byte');
    }
    return secret;
  }

  private signedDirectoryHeaders(
    payload: string,
    requestId: string,
  ): Record<string, string> {
    const timestamp = Date.now().toString();
    const context = `GET:${DIRECTORY_PATH}`;
    const signature = createHmac('sha256', this.userInternalSecret)
      .update(`${timestamp}.${requestId}.${payload}.${context}`)
      .digest('hex');
    return {
      'x-request-id': requestId,
      'x-user-payload': payload,
      'x-user-timestamp': timestamp,
      'x-user-signature': signature,
    };
  }
}
