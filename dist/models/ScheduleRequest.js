import mongoose, { Schema } from 'mongoose';
const scheduleRequestSchema = new Schema({
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
}, { timestamps: true });
scheduleRequestSchema.index({ employee_id: 1, week_start: 1 }, { unique: true });
export const ScheduleRequest = mongoose.model('ScheduleRequest', scheduleRequestSchema);
