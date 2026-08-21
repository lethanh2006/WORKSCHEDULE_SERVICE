import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from "mongoose";

export type AttendanceQrTokenDocument = HydratedDocument<AttendanceQrToken>;

@Schema({ timestamps: true, collection: "attendanceqrtokens" })
export class AttendanceQrToken {
  @Prop({ required: true, unique: true })
  token!: string;
  @Prop({ required: true })
  date!: Date;
  @Prop({ required: true })
  expires_at!: Date;
  @Prop({ default: false })
  used!: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId })
  used_by?: Types.ObjectId;
  @Prop()
  used_at?: Date;
}
export const AttendanceQrTokenSchema =
  SchemaFactory.createForClass(AttendanceQrToken);
