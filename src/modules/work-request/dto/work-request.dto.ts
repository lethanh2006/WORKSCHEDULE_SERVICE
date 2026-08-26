import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { WorkPeriod } from '../../../schemas/schedule-entry.schema';
import type { WorkRequestType } from '../../../schemas/work-request.schema';

export class CreateWorkRequestDto {
  @IsIn(['leave', 'late', 'early', 'overtime', 'business_trip', 'remote'])
  type!: WorkRequestType;

  @IsISO8601()
  start_at!: string;

  @IsOptional()
  @IsISO8601()
  end_at?: string;

  @IsIn(['full_day', 'morning', 'afternoon'])
  period!: WorkPeriod;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  project?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_cost?: number;

  @IsOptional()
  @IsString()
  manager_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_urls?: string[];

  @IsOptional()
  @IsBoolean()
  is_school_leave?: boolean;
}

export class RejectWorkRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
