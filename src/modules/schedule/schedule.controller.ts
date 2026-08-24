import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Authenticated } from "../../common/decorators/authenticated.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { SCHEDULE_MANAGERS } from "../../common/enums/role.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { RequestWithContext } from "../../common/interfaces/request-context.interface";
import { forwardedRequestContext } from "../../common/utils/request.util";
import {
  BulkApproveScheduleDto,
  CreateScheduleRequestDto,
  RejectScheduleRequestDto,
  ResubmitScheduleRequestDto,
  UpdateScheduleEntriesDto,
} from "./dto/schedule.dto";
import { ScheduleService } from "./schedule.service";

@Controller("api/workschedule")
@UseGuards(RolesGuard)
export class ScheduleController {
  constructor(private readonly schedules: ScheduleService) {}

  @Get("schedule/pending")
  @Roles(...SCHEDULE_MANAGERS)
  pending(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.getPending(query, forwardedRequestContext(request));
  }

  @Get("schedule/all")
  @Roles(...SCHEDULE_MANAGERS)
  all(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.getAll(query, forwardedRequestContext(request));
  }

  @Post("schedule/requests/:id/approve")
  @HttpCode(200)
  @Roles(...SCHEDULE_MANAGERS)
  approve(@Param("id") id: string, @Req() request: RequestWithContext) {
    return this.schedules.approve(id, request.user!);
  }

  @Post("schedule/requests/:id/reject")
  @HttpCode(200)
  @Roles(...SCHEDULE_MANAGERS)
  reject(
    @Param("id") id: string,
    @Body() dto: RejectScheduleRequestDto,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.reject(id, dto, request.user!);
  }

  @Post("schedule/requests/bulk-approve")
  @HttpCode(200)
  @Roles(...SCHEDULE_MANAGERS)
  bulkApprove(
    @Body() dto: BulkApproveScheduleDto,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.bulkApprove(dto, request.user!);
  }

  @Get("schedule/heatmap")
  @Roles(...SCHEDULE_MANAGERS)
  heatmap(@Query() query: Record<string, string>) {
    return this.schedules.heatmap(query);
  }

  @Get("schedule/monthly-overview")
  @Authenticated()
  monthlyOverview(
    @Query("month") month: string,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.monthlyOverview(month, request.user!);
  }

  @Get("schedule/my")
  @Authenticated()
  mine(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.getMine(
      query,
      request.user!,
      forwardedRequestContext(request),
    );
  }

  @Post("schedule/requests")
  @Authenticated()
  create(
    @Body() dto: CreateScheduleRequestDto,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.create(dto, request.user!);
  }

  @Post("schedule/requests/:id/resubmit")
  @HttpCode(200)
  @Authenticated()
  resubmit(
    @Param("id") id: string,
    @Body() dto: ResubmitScheduleRequestDto,
    @Req() request: RequestWithContext,
  ) {
    return this.schedules.resubmit(id, dto, request.user!);
  }

  @Get("schedule/requests/:id")
  @Roles(...SCHEDULE_MANAGERS)
  info(@Param("id") id: string, @Req() request: RequestWithContext) {
    return this.schedules.getInfo(id, forwardedRequestContext(request));
  }

  @Patch("schedule/requests/:id")
  @Roles(...SCHEDULE_MANAGERS)
  update(@Param("id") id: string, @Body() dto: UpdateScheduleEntriesDto) {
    return this.schedules.update(id, dto);
  }

  @Delete("schedule/requests/:id")
  @Roles(...SCHEDULE_MANAGERS)
  remove(@Param("id") id: string) {
    return this.schedules.remove(id);
  }
}
