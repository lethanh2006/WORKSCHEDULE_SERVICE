import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';

export type ScheduleEntryDocument = HydratedDocument<ScheduleEntry>;
export type ScheduleEntryType = 'office' | 'remote' | 'day_off' | 'leave';
export type WorkPeriod = 'full_day' | 'morning' | 'afternoon';

@Schema({ timestamps: true, collection: 'scheduleentries' })
export class ScheduleEntry {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ScheduleRequest',
    required: true,
  })
  request_id!: Types.ObjectId;
  @Prop({ required: true })
  date!: Date;
  @Prop({
    type: String,
    enum: ['office', 'remote', 'day_off', 'leave'],
    required: true,
  })
  type!: ScheduleEntryType;
  @Prop({
    type: String,
    enum: ['full_day', 'morning', 'afternoon'],
    default: 'full_day',
    required: true,
  })
  period!: WorkPeriod;
  @Prop({ trim: true, maxlength: 200 })
  note?: string;
}
export const ScheduleEntrySchema = SchemaFactory.createForClass(ScheduleEntry);
ScheduleEntrySchema.index({ request_id: 1, date: 1 }, { unique: true });
