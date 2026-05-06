import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendanceRecord extends Document {
  employee_id: mongoose.Types.ObjectId;
  date: Date;
  schedule_type: 'office' | 'remote';
  check_in_at?: Date;
  check_out_at?: Date;
  source: 'qr' | 'schedule';
  check_in_token_id?: mongoose.Types.ObjectId;
  check_out_token_id?: mongoose.Types.ObjectId;
}

const attendanceRecordSchema: Schema<IAttendanceRecord> = new Schema(
  {
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
  },
  { timestamps: true }
);

export const AttendanceRecord = mongoose.model<IAttendanceRecord>('AttendanceRecord', attendanceRecordSchema);
