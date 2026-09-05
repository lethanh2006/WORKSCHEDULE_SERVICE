import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';
import { endOfVietnamMonth } from '../utils/schedule-month';

export type WorkPolicyDocument = HydratedDocument<WorkPolicy>;
export const WORK_POLICY_SINGLETON_KEY = 'default';

@Schema({ timestamps: true, collection: 'workpolicies' })
export class WorkPolicy {
  @Prop({
    type: String,
    enum: [WORK_POLICY_SINGLETON_KEY],
    default: WORK_POLICY_SINGLETON_KEY,
  })
  singleton_key!: typeof WORK_POLICY_SINGLETON_KEY;

  @Prop({ required: true, default: Date.now })
  registration_start!: Date;
  @Prop({
    required: true,
    default: () => endOfVietnamMonth(),
  })
  registration_end!: Date;
  @Prop({ required: true, default: true })
  locked!: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId })
  updated_by?: Types.ObjectId;
}
export const WorkPolicySchema = SchemaFactory.createForClass(WorkPolicy);
WorkPolicySchema.index(
  { singleton_key: 1 },
  {
    unique: true,
    partialFilterExpression: { singleton_key: { $type: 'string' } },
  },
);
