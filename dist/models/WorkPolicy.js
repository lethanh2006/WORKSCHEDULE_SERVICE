import mongoose, { Schema } from 'mongoose';
const workPolicySchema = new Schema({
    submit_deadline_day: {
        type: Number,
        required: true,
        min: 0,
        max: 6,
        default: 5
    },
    submit_deadline_hour: {
        type: Number,
        required: true,
        min: 0,
        max: 23,
        default: 17
    },
    lock_schedule_days: {
        type: Number,
        required: true,
        default: 7
    },
    updated_by: {
        type: Schema.Types.ObjectId,
        required: false
    }
}, { timestamps: true });
export const WorkPolicy = mongoose.model('WorkPolicy', workPolicySchema);
