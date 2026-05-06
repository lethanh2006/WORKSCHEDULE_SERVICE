import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduleEntry extends Document {
  request_id: mongoose.Types.ObjectId;
  date: Date;
  type: 'office' | 'remote' | 'day_off' | 'leave';
  note?: string;
}

const scheduleEntrySchema: Schema<IScheduleEntry> = new Schema(
  {
    request_id: { type: Schema.Types.ObjectId, ref: 'ScheduleRequest', required: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ['office', 'remote', 'day_off', 'leave'],
      required: true
    },
    note: { type: String }
  },
  { timestamps: true }
);

export const ScheduleEntry = mongoose.model<IScheduleEntry>('ScheduleEntry', scheduleEntrySchema);
