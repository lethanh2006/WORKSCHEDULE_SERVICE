import mongoose, { Schema } from 'mongoose';
const attendanceRecordSchema = new Schema({
    employee_id: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    schedule_type: {
        type: String,
        enum: ['office', 'remote'],
        required: true
    },
    check_in_at: { type: Date },
    check_out_at: { type: Date },
    source: {
        type: String,
        enum: ['qr', 'schedule'],
        required: true
    },
    check_in_token_id: { type: Schema.Types.ObjectId, ref: 'AttendanceQrToken' },
    check_out_token_id: { type: Schema.Types.ObjectId, ref: 'AttendanceQrToken' }
}, { timestamps: true });
export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);
