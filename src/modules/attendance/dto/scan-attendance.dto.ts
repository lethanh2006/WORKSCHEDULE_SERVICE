import { IsNotEmpty, IsString } from 'class-validator';

export class ScanAttendanceDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
