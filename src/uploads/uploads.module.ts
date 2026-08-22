import { Module } from '@nestjs/common';
import { ChatImageUploadController, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController, ChatImageUploadController],
  providers: [UploadsService],
})
export class UploadsModule {}
