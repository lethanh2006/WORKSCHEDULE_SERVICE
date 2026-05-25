import mongoose, { Schema } from 'mongoose';
const workPolicySchema = new Schema({
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
    locked: {
        type: Boolean,
        required: true,
        default: true
    },
    updated_by: {
        type: Schema.Types.ObjectId,
        required: false
    }
}, { timestamps: true });
export const WorkPolicy = mongoose.model('WorkPolicy', workPolicySchema);
