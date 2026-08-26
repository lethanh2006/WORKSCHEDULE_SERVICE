import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';
import type { WorkPeriod } from './schedule-entry.schema';

export type WorkRequestDocument = HydratedDocument<WorkRequest>;
export type WorkRequestType =
  'leave' | 'late' | 'early' | 'overtime' | 'business_trip' | 'remote';
export type WorkRequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled';

@Schema({ timestamps: true, collection: 'workrequests' })
export class WorkRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  employee_id!: Types.ObjectId;
  @Prop({
    type: String,
    enum: ['leave', 'late', 'early', 'overtime', 'business_trip', 'remote'],
    required: true,
    index: true,
  })
  type!: WorkRequestType;
  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    required: true,
    index: true,
  })
  status!: WorkRequestStatus;
  @Prop({ required: true, index: true })
  start_at!: Date;
  @Prop()
  end_at?: Date;
  @Prop({
    type: String,
    enum: ['full_day', 'morning', 'afternoon'],
    default: 'full_day',
    required: true,
  })
  period!: WorkPeriod;
  @Prop({ required: true, trim: true, maxlength: 1000 })
  reason!: string;
  @Prop({ trim: true, maxlength: 300 })
  location?: string;
  @Prop({ trim: true, maxlength: 300 })
  project?: string;
  @Prop({ min: 0 })
  estimated_cost?: number;
  @Prop({ type: MongooseSchema.Types.ObjectId })
  manager_id?: Types.ObjectId;
  @Prop({ type: [{ type: String, trim: true, maxlength: 1000 }], default: [] })
  attachment_urls!: string[];
  @Prop({ default: false })
  is_school_leave!: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId })
  reviewed_by?: Types.ObjectId;
  @Prop()
  reviewed_at?: Date;
  @Prop({ trim: true, maxlength: 500 })
  reject_reason?: string;
}
export const WorkRequestSchema = SchemaFactory.createForClass(WorkRequest);
WorkRequestSchema.index({ employee_id: 1, start_at: -1 });
WorkRequestSchema.index({ status: 1, createdAt: -1 });
