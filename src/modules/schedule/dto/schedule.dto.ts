import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import type {
  ScheduleEntryType,
  WorkPeriod,
} from '../../../schemas/schedule-entry.schema';

export class ScheduleEntryDto {
  @IsDateString()
  date!: string;

  @IsIn(['office', 'remote', 'day_off', 'leave'])
  type!: ScheduleEntryType;

  @IsIn(['full_day', 'morning', 'afternoon'])
  period!: WorkPeriod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CreateScheduleRequestDto {
  @IsString()
  @Matches(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/, {
    message: 'Tháng đăng ký phải có định dạng YYYY-MM.',
  })
  month!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  entries!: ScheduleEntryDto[];
}

export class UpdateScheduleEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  entries!: ScheduleEntryDto[];
}

export class ResubmitScheduleRequestDto extends UpdateScheduleEntriesDto {}

export class RejectScheduleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class BulkApproveScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}
