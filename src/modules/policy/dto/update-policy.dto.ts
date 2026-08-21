import { IsBoolean, IsISO8601, IsOptional } from "class-validator";

export class UpdatePolicyDto {
  @IsOptional()
  @IsISO8601()
  registration_start?: string;

  @IsOptional()
  @IsISO8601()
  registration_end?: string;

  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
