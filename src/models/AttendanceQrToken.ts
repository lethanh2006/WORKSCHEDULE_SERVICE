import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendanceQrToken extends Document {
  token: string;
  date: Date;
  expires_at: Date;
  used: boolean;
  used_by?: mongoose.Types.ObjectId;
  used_at?: Date;
}

const attendanceQrTokenSchema: Schema<IAttendanceQrToken> = new Schema(
  {
    token: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    expires_at: { type: Date, required: true },
    used: { type: Boolean, default: false },
    used_by: { type: Schema.Types.ObjectId },
    used_at: { type: Date }
  },
  { timestamps: true }
);

export const AttendanceQrToken = mongoose.model<IAttendanceQrToken>('AttendanceQrToken', attendanceQrTokenSchema);
