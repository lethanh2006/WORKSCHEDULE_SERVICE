import mongoose, { Schema } from 'mongoose';
const attendanceQrTokenSchema = new Schema({
    token: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    expires_at: { type: Date, required: true },
    used: { type: Boolean, default: false },
    used_by: { type: Schema.Types.ObjectId },
    used_at: { type: Date }
}, { timestamps: true });
export const AttendanceQrToken = mongoose.model('AttendanceQrToken', attendanceQrTokenSchema);
