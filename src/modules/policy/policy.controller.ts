import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Role, Roles } from '../../common/auth';
import type { RequestWithContext } from '../../common/request-context';
import { RolesGuard } from '../../common/roles.guard';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PolicyService } from './policy.service';

@Controller('api/workschedule/policy')
@UseGuards(RolesGuard)
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  getPolicy() {
    return this.policyService.getPolicy();
  }

  @Patch()
  @Roles(Role.ADMIN)
  updatePolicy(
    @Body() dto: UpdatePolicyDto,
    @Req() request: RequestWithContext,
  ) {
    return this.policyService.updatePolicy(dto, request.user!);
  }
}
