import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';

export type AttendanceRecordDocument = HydratedDocument<AttendanceRecord>;

@Schema({ timestamps: true, collection: 'attendancerecords' })
export class AttendanceRecord {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  employee_id!: Types.ObjectId;
  @Prop({ required: true })
  date!: Date;
  @Prop({ type: String, enum: ['office', 'remote'], required: true })
  schedule_type!: 'office' | 'remote';
  @Prop()
  check_in_at?: Date;
  @Prop()
  check_out_at?: Date;
  @Prop({ type: String, enum: ['qr', 'schedule'], required: true })
  source!: 'qr' | 'schedule';
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AttendanceQrToken' })
  check_in_token_id?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AttendanceQrToken' })
  check_out_token_id?: Types.ObjectId;
}
export const AttendanceRecordSchema =
  SchemaFactory.createForClass(AttendanceRecord);
AttendanceRecordSchema.index(
  { employee_id: 1, date: 1, source: 1 },
  { unique: true },
);
