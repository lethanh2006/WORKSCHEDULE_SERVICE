import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  WorkRequest,
  WorkRequestSchema,
} from "../../schemas/work-request.schema";
import { UserClientModule } from "../user-client/user-client.module";
import { WorkRequestController } from "./work-request.controller";
import { WorkRequestService } from "./work-request.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkRequest.name, schema: WorkRequestSchema },
    ]),
    UserClientModule,
  ],
  controllers: [WorkRequestController],
  providers: [WorkRequestService],
})
export class WorkRequestModule {}
