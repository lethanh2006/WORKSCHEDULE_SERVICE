import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTHENTICATED_KEY } from "../decorators/authenticated.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import {
  type AuthenticatedUser,
  parseAuthenticatedUser,
  type RequestWithAuthenticatedUser,
} from "../interfaces/authenticated-user.interface";
import { GatewaySignatureService } from "../security/gateway-signature.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly signatureService: GatewaySignatureService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuthenticatedUser>();
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const authenticated = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles && !authenticated) return true;

    const encoded = request.headers["x-user-payload"];
    if (typeof encoded !== "string") {
      throw new UnauthorizedException({ message: "Unauthorized" });
    }

    this.signatureService.assertTrusted({
      context: `${request.method.toUpperCase()}:${request.path}`,
      payload: encoded,
      requestId: this.headerValue(request.headers["x-request-id"]),
      signature: this.headerValue(request.headers["x-user-signature"]),
      timestamp: this.headerValue(request.headers["x-user-timestamp"]),
    });
    let user: AuthenticatedUser | null;
    try {
      user = parseAuthenticatedUser(
        JSON.parse(Buffer.from(encoded, "base64").toString("utf8")),
      );
    } catch {
      user = null;
    }
    if (!user) {
      throw new UnauthorizedException({
        message: "Payload người dùng không hợp lệ",
      });
    }
    request.user = user;

    const role = user.role?.toLowerCase();
    if (
      roles &&
      (!role || !roles.some((item) => item.toLowerCase() === role))
    ) {
      throw new ForbiddenException({
        success: false,
        message: "Bạn không có quyền truy cập vào tài nguyên này.",
      });
    }
    return true;
  }

  private headerValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return typeof value === "string" ? value : undefined;
  }
}
