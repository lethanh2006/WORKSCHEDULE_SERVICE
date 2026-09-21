import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Authenticated, Roles, SCHEDULE_MANAGERS } from '../../common/auth';
import type { RequestWithContext } from '../../common/request-context';
import { forwardedRequestContext } from '../../common/request.util';
import { RolesGuard } from '../../common/roles.guard';
import { AttendanceService } from './attendance.service';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';

@Controller('api/workschedule/attendance')
@UseGuards(RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('scan')
  @HttpCode(200)
  @Authenticated()
  scan(@Body() dto: ScanAttendanceDto, @Req() request: RequestWithContext) {
    return this.attendance.scan(dto, request.user!);
  }

  @Get('my')
  @Authenticated()
  mine(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.attendance.getMine(query, request.user!);
  }

  @Post('qr/generate')
  @Roles(...SCHEDULE_MANAGERS)
  generate() {
    return this.attendance.generateQrToken();
  }

  @Get('today')
  @Roles(...SCHEDULE_MANAGERS)
  today(@Req() request: RequestWithContext) {
    return this.attendance.getToday(forwardedRequestContext(request));
  }

  @Get('report')
  @Roles(...SCHEDULE_MANAGERS)
  report(
    @Query() query: Record<string, string>,
    @Req() request: RequestWithContext,
  ) {
    return this.attendance.getReport(query, forwardedRequestContext(request));
  }
}
