import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator';
import { VendorApprovedGuard } from '../common/guards/vendor-approved.guard';
import { UserRole } from '../entities/enums';
import { UploadsService } from './uploads.service';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const FILE_VALIDATORS = () => [
  // Accept any image/* mimetype the browser reports (jpeg, png, gif, webp,
  // avif, heic/heif, tiff, svg, bmp, ico, ...) — every format sharp can
  // actually decode gets normalized to the same output JPEG, and
  // UploadsService throws a clear 400 for anything it can't decode rather
  // than 500ing.
  new FileTypeValidator({ fileType: /^image\// }),
  new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
];

/** Only an approved vendor uploads product catalog photos. */
@Roles(UserRole.VENDOR)
@UseGuards(VendorApprovedGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(new ParseFilePipe({ validators: FILE_VALIDATORS() })) file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const url = await this.uploadsService.saveProductImage(file);
    return { url };
  }
}

/** Deliberately open to any authenticated role, unlike UploadsController —
 * both a buyer and a vendor send images in chat, and neither needs to be an
 * approved vendor to do it. */
@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('uploads/chat-image')
export class ChatImageUploadController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadChatImage(
    @UploadedFile(new ParseFilePipe({ validators: FILE_VALIDATORS() })) file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const url = await this.uploadsService.saveChatImage(file);
    return { url };
  }
}
