import mongoose, { Schema } from 'mongoose';
const workRequestSchema = new Schema({
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
}, { timestamps: true });
workRequestSchema.index({ employee_id: 1, start_at: -1 });
workRequestSchema.index({ status: 1, createdAt: -1 });
export const WorkRequest = mongoose.model('WorkRequest', workRequestSchema);
