import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';

export type ScheduleRequestDocument = HydratedDocument<ScheduleRequest>;

@Schema({ timestamps: true, collection: 'schedulerequests' })
export class ScheduleRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  employee_id!: Types.ObjectId;
  @Prop({ required: true })
  week_start!: Date;
  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status!: 'pending' | 'approved' | 'rejected';
  @Prop()
  submitted_at?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId })
  reviewed_by?: Types.ObjectId;
  @Prop()
  reviewed_at?: Date;
  @Prop()
  reject_reason?: string;
}
export const ScheduleRequestSchema =
  SchemaFactory.createForClass(ScheduleRequest);
ScheduleRequestSchema.index(
  { employee_id: 1, week_start: 1 },
  { unique: true },
);
