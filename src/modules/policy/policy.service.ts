import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from "../../common/interfaces/authenticated-user.interface";
import {
  WorkPolicy,
  type WorkPolicyDocument,
} from "../../schemas/work-policy.schema";
import { UpdatePolicyDto } from "./dto/update-policy.dto";

@Injectable()
export class PolicyService {
  constructor(
    @InjectModel(WorkPolicy.name)
    private readonly policyModel: Model<WorkPolicyDocument>,
  ) {}

  async getPolicy() {
    try {
      let policy = await this.policyModel.findOne();
      if (!policy) {
        const now = new Date();
        policy = await this.policyModel.create({
          registration_start: now,
          registration_end: new Date(now.getTime() + 30 * 86_400_000),
          locked: true,
        });
      }
      return { success: true, count: 1, data: policy };
    } catch {
      throw new HttpException(
        { success: false, message: "Server Error" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePolicy(dto: UpdatePolicyDto, user: AuthenticatedUser) {
    try {
      let policy = await this.policyModel.findOne();
      if (policy) {
        if (dto.registration_start)
          policy.registration_start = new Date(dto.registration_start);
        if (dto.registration_end)
          policy.registration_end = new Date(dto.registration_end);
        if (typeof dto.locked === "boolean") policy.locked = dto.locked;
        policy.updated_by = authenticatedUserId(user) as any;
        await policy.save();
      } else {
        policy = await this.policyModel.create({
          ...(dto.registration_start
            ? { registration_start: new Date(dto.registration_start) }
            : {}),
          ...(dto.registration_end
            ? { registration_end: new Date(dto.registration_end) }
            : {}),
          locked: typeof dto.locked === "boolean" ? dto.locked : true,
          updated_by: authenticatedUserId(user),
        });
      }
      return { success: true, data: policy };
    } catch {
      throw new HttpException(
        { success: false, message: "Server Error" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
