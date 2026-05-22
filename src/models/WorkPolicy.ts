import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkPolicy extends Document {
  registration_start: Date;
  registration_end: Date;
  updated_by?: mongoose.Types.ObjectId;
}

const workPolicySchema: Schema<IWorkPolicy> = new Schema(
  {
    registration_start: {
      type: Date,
      required: true,
      default: Date.now
    },
    registration_end: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default to 30 days from now
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      required: false
    }
  },
  { timestamps: true }
);

export const WorkPolicy = mongoose.model<IWorkPolicy>('WorkPolicy', workPolicySchema);
