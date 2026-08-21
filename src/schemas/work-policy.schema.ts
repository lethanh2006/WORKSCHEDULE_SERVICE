import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from "mongoose";

export type WorkPolicyDocument = HydratedDocument<WorkPolicy>;

@Schema({ timestamps: true, collection: "workpolicies" })
export class WorkPolicy {
  @Prop({ required: true, default: Date.now })
  registration_start!: Date;
  @Prop({
    required: true,
    default: () => new Date(Date.now() + 30 * 86_400_000),
  })
  registration_end!: Date;
  @Prop({ required: true, default: true })
  locked!: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId })
  updated_by?: Types.ObjectId;
}
export const WorkPolicySchema = SchemaFactory.createForClass(WorkPolicy);
