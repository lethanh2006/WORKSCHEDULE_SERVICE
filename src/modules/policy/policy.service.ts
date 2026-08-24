import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from "../../common/interfaces/authenticated-user.interface";
import {
  WorkPolicy,
  WORK_POLICY_SINGLETON_KEY,
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
    const policy = await this.getActivePolicy();
    return { success: true, count: 1, data: policy };
  }

  async updatePolicy(dto: UpdatePolicyDto, user: AuthenticatedUser) {
    const current = await this.getActivePolicy();
    const registrationStart = dto.registration_start
      ? new Date(dto.registration_start)
      : current.registration_start;
    const registrationEnd = dto.registration_end
      ? new Date(dto.registration_end)
      : current.registration_end;

    if (registrationStart >= registrationEnd) {
      throw new BadRequestException({
        success: false,
        message: "Thời gian kết thúc đăng ký phải sau thời gian bắt đầu.",
      });
    }

    const policy = await this.policyModel.findOneAndUpdate(
      { _id: current._id, singleton_key: WORK_POLICY_SINGLETON_KEY },
      {
        $set: {
          registration_start: registrationStart,
          registration_end: registrationEnd,
          locked: typeof dto.locked === "boolean" ? dto.locked : current.locked,
          updated_by: authenticatedUserId(user),
        },
      },
      { new: true, runValidators: true },
    );
    if (!policy) {
      throw new InternalServerErrorException({
        success: false,
        message: "Không thể cập nhật chính sách làm việc.",
      });
    }
    return { success: true, data: policy };
  }

  async getActivePolicy(): Promise<WorkPolicyDocument> {
    const singleton = await this.policyModel.findOne({
      singleton_key: WORK_POLICY_SINGLETON_KEY,
    });
    if (singleton) return singleton;

    try {
      const legacy = await this.policyModel.findOneAndUpdate(
        { singleton_key: { $exists: false } },
        { $set: { singleton_key: WORK_POLICY_SINGLETON_KEY } },
        { new: true },
      );
      if (legacy) return legacy;
    } catch (error: unknown) {
      if (!this.isDuplicateKeyError(error)) throw error;
      const claimed = await this.policyModel.findOne({
        singleton_key: WORK_POLICY_SINGLETON_KEY,
      });
      if (claimed) return claimed;
    }

    const now = new Date();
    const created = await this.policyModel.findOneAndUpdate(
      { singleton_key: WORK_POLICY_SINGLETON_KEY },
      {
        $setOnInsert: {
          singleton_key: WORK_POLICY_SINGLETON_KEY,
          registration_start: now,
          registration_end: new Date(now.getTime() + 30 * 86_400_000),
          locked: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (!created) {
      throw new InternalServerErrorException({
        success: false,
        message: "Không thể khởi tạo chính sách làm việc.",
      });
    }
    return created;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
