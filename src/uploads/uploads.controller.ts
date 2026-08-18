import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { VendorApprovedGuard } from '../common/guards/vendor-approved.guard';
import { UserRole } from '../entities/enums';
import { UploadsService } from './uploads.service';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

/** Same gate as product mutations (`@Roles(VENDOR)` + `VendorApprovedGuard`)
 * — only an approved vendor uploads product photos; there is nothing else
 * on the platform that needs a generic image upload today. */
@Roles(UserRole.VENDOR)
@UseGuards(VendorApprovedGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Accept any image/* mimetype the browser reports (jpeg, png, gif,
          // webp, avif, heic/heif, tiff, svg, bmp, ico, ...) — every format
          // sharp can actually decode gets normalized to the same output
          // JPEG below, and UploadsService throws a clear 400 for anything
          // it can't decode rather than 500ing.
          new FileTypeValidator({ fileType: /^image\// }),
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const originBaseUrl = `${req.protocol}://${req.get('host')}`;
    const url = await this.uploadsService.saveProductImage(file, originBaseUrl);
    return { url };
  }
}
