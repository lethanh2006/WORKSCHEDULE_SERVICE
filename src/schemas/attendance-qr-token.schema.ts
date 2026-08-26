import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type AttendanceQrTokenDocument = HydratedDocument<AttendanceQrToken>;

@Schema({ timestamps: true, collection: 'attendanceqrtokens' })
export class AttendanceQrToken {
  @Prop({ required: true, unique: true })
  token!: string;
  @Prop({ required: true })
  date!: Date;
  @Prop({ required: true })
  expires_at!: Date;
}
export const AttendanceQrTokenSchema =
  SchemaFactory.createForClass(AttendanceQrToken);
AttendanceQrTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
