import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SCHEDULE_MANAGERS } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestWithContext } from '../../common/interfaces/request-context.interface';
import { forwardedRequestContext } from '../../common/utils/request.util';
import {
  CreateWorkRequestDto,
  RejectWorkRequestDto,
} from './dto/work-request.dto';
import { WorkRequestService } from './work-request.service';

@Controller('api/workschedule/requests')
@UseGuards(RolesGuard)
export class WorkRequestController {
  constructor(private readonly requests: WorkRequestService) {}

  @Get('my/stats')
  @Authenticated()
  stats(@Query('month') month: string, @Req() request: RequestWithContext) {
    return this.requests.stats(month, request.user!);
  }

  @Get('my')
  @Authenticated()
  mine(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.requests.getMine(query, request.user!);
  }

  @Post()
  @Authenticated()
  create(
    @Body() dto: CreateWorkRequestDto,
    @Req() request: RequestWithContext,
  ) {
    return this.requests.create(dto, request.user!);
  }

  @Patch(':id/cancel')
  @Authenticated()
  cancel(@Param('id') id: string, @Req() request: RequestWithContext) {
    return this.requests.cancel(id, request.user!);
  }

  @Get('admin')
  @Roles(...SCHEDULE_MANAGERS)
  admin(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.requests.getAdmin(query, forwardedRequestContext(request));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles(...SCHEDULE_MANAGERS)
  approve(@Param('id') id: string, @Req() request: RequestWithContext) {
    return this.requests.approve(id, request.user!);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles(...SCHEDULE_MANAGERS)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectWorkRequestDto,
    @Req() request: RequestWithContext,
  ) {
    return this.requests.reject(id, dto, request.user!);
  }
}
