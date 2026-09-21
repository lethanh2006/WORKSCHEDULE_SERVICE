# Luồng dùng chung của Workschedule

Đọc theo thứ tự: `src/main.ts` → `src/core/core.module.ts` → controller và service trong `src/modules/{policy,schedule,attendance,work-request}`.

1. `main.ts` khởi tạo Nest, logger và `ValidationPipe`. `CoreModule` đăng ký middleware, guard, filter, logger và dịch vụ kiểm tra chữ ký Gateway.
2. `common/middleware/request-id.middleware.ts` giữ hoặc tạo request ID, đưa vào request/response và ngữ cảnh log.
3. `common/guards/roles.guard.ts` đọc `@Authenticated()` / `@Roles()` từ `common/decorators`. Với endpoint cần xác thực, guard gọi `common/security/gateway-signature.service.ts` để kiểm tra chữ ký và chống phát lại, sau đó đọc user bằng `common/utils/authenticated-user.util.ts`.
4. Controller gọi service nghiệp vụ. `common/enums/role.enum.ts` chứa role và nhóm quản lý lịch; `common/interfaces` chứa kiểu user/request. `common/utils/request.util.ts` lấy request ID và payload để chuyển tiếp tới User service khi cần.
5. Khi có lỗi, `common/filters/global-exception.filter.ts` gọi `StructuredLoggerService.handleHttpException` để trả lỗi theo hợp đồng hiện tại và ghi log. `common/logging/logger.ts` tập trung logger, adapter Nest và `LoggerLifecycleService` để flush log khi dừng ứng dụng.

`common` chỉ chứa thành phần dùng xuyên module. Quy tắc lịch, chấm công, đơn đề nghị, DTO và schema nằm tại module/schema tương ứng. Chữ ký Gateway, chống phát lại và việc flush log đều được dùng khi chạy production.

Chạy kiểm tra: `npm run format:check`, `npm run lint`, `npm run build`, `npm test -- --runInBand`. `npm run test:e2e` kiểm tra luồng qua Gateway bằng MongoDB tạm; cần Docker hoặc biến `MONGOD_BINARY` trỏ tới mongod local.
