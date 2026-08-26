import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestWithContext } from '../../common/interfaces/request-context.interface';
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
