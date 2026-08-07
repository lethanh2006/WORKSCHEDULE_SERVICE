import mongoose, { Schema } from 'mongoose';
const scheduleEntrySchema = new Schema({
    request_id: { type: Schema.Types.ObjectId, ref: 'ScheduleRequest', required: true },
    date: { type: Date, required: true },
    type: {
        type: String,
        enum: ['office', 'remote', 'day_off', 'leave'],
        required: true
    },
    period: {
        type: String,
        enum: ['full_day', 'morning', 'afternoon'],
        default: 'full_day',
        required: true
    },
    note: { type: String, trim: true, maxlength: 200 }
}, { timestamps: true });
export const ScheduleEntry = mongoose.model('ScheduleEntry', scheduleEntrySchema);
