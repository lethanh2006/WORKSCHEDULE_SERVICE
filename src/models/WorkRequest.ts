import mongoose, { Document, Schema } from 'mongoose';

export type WorkRequestType =
  | 'leave'
  | 'late'
  | 'early'
  | 'overtime'
  | 'business_trip'
  | 'remote';

export type WorkRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface IWorkRequest extends Document {
  employee_id: mongoose.Types.ObjectId;
  type: WorkRequestType;
  status: WorkRequestStatus;
  start_at: Date;
  end_at?: Date;
  period: 'full_day' | 'morning' | 'afternoon';
  reason: string;
  location?: string;
  project?: string;
  estimated_cost?: number;
  manager_id?: mongoose.Types.ObjectId;
  attachment_urls: string[];
  is_school_leave: boolean;
  reviewed_by?: mongoose.Types.ObjectId;
  reviewed_at?: Date;
  reject_reason?: string;
}

const workRequestSchema: Schema<IWorkRequest> = new Schema(
  {
    employee_id: { type: Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: ['leave', 'late', 'early', 'overtime', 'business_trip', 'remote'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      required: true,
      index: true
    },
    start_at: { type: Date, required: true, index: true },
    end_at: { type: Date },
    period: {
      type: String,
      enum: ['full_day', 'morning', 'afternoon'],
      default: 'full_day',
      required: true
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    location: { type: String, trim: true, maxlength: 300 },
    project: { type: String, trim: true, maxlength: 300 },
    estimated_cost: { type: Number, min: 0 },
    manager_id: { type: Schema.Types.ObjectId },
    attachment_urls: {
      type: [{ type: String, trim: true, maxlength: 1000 }],
      default: []
    },
    is_school_leave: { type: Boolean, default: false },
    reviewed_by: { type: Schema.Types.ObjectId },
    reviewed_at: { type: Date },
    reject_reason: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

workRequestSchema.index({ employee_id: 1, start_at: -1 });
workRequestSchema.index({ status: 1, createdAt: -1 });

export const WorkRequest = mongoose.model<IWorkRequest>('WorkRequest', workRequestSchema);
