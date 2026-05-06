import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduleRequest extends Document {
  employee_id: mongoose.Types.ObjectId;
  week_start: Date;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  submitted_at?: Date;
  reviewed_by?: mongoose.Types.ObjectId;
  reviewed_at?: Date;
  reject_reason?: string;
}

const scheduleRequestSchema: Schema<IScheduleRequest> = new Schema(
  {
    employee_id: { type: Schema.Types.ObjectId, required: true },
    week_start: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft'
    },
    submitted_at: { type: Date },
    reviewed_by: { type: Schema.Types.ObjectId },
    reviewed_at: { type: Date },
    reject_reason: { type: String }
  },
  { timestamps: true }
);

scheduleRequestSchema.index({ employee_id: 1, week_start: 1 }, { unique: true });

export const ScheduleRequest = mongoose.model<IScheduleRequest>('ScheduleRequest', scheduleRequestSchema);
