import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkPolicy, WorkPolicySchema } from '../../schemas/work-policy.schema';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkPolicy.name, schema: WorkPolicySchema },
    ]),
  ],
  controllers: [PolicyController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
