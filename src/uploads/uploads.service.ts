import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';
import sharp, { Sharp } from 'sharp';

const PRODUCT_IMAGE_SIZE = 1200;
const CHAT_IMAGE_MAX_DIMENSION = 1600;

@Injectable()
export class UploadsService {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUD_NAME'),
      api_key: config.get<string>('CLOUDNARY_API_KEY'),
      api_secret: config.get<string>('CLOUDNARY_API_SECRET'),
    });
  }

  /**
   * Every product photo gets forced to the same PRODUCT_IMAGE_SIZE x
   * PRODUCT_IMAGE_SIZE square JPEG regardless of what a vendor uploads —
   * `fit: 'cover'` crops rather than letterboxes, and `position: 'attention'`
   * lets sharp pick the highest-entropy region instead of a blind center
   * crop. This guarantees uniform stored dimensions (not just uniform CSS
   * display) and caps file size before it ever leaves this process,
   * regardless of what Cloudinary would otherwise accept.
   *
   * Uploaded to Cloudinary rather than local disk: on serverless hosts
   * (Vercel) there is no writable disk between invocations at all, and even
   * on hosts with a writable disk (Render) it isn't persistent across
   * restarts/redeploys — Cloudinary is the actual source of truth for
   * product images in every environment, including local dev.
   */
  saveProductImage(file: Express.Multer.File): Promise<string> {
    return this.processAndUpload(file, { folder: 'products' }, (image) =>
      image.resize(PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE, { fit: 'cover', position: 'attention' }),
    );
  }

  /**
   * Chat images are NOT force-cropped square — a screenshot or a product
   * photo shared mid-conversation should keep its real aspect ratio, unlike
   * a catalog thumbnail. Only capped so nobody can send an oversized
   * original through the chat composer; `fit: 'inside'` only shrinks images
   * already larger than the cap and never upscales a smaller one.
   */
  saveChatImage(file: Express.Multer.File): Promise<string> {
    return this.processAndUpload(file, { folder: 'chat' }, (image) =>
      image.resize(CHAT_IMAGE_MAX_DIMENSION, CHAT_IMAGE_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      }),
    );
  }

  private async processAndUpload(
    file: Express.Multer.File,
    uploadOptions: UploadApiOptions,
    resize: (image: Sharp) => Sharp,
  ): Promise<string> {
    // The controller only checks the browser-reported mimetype starts with
    // "image/" — sharp is the real authority on whether it can actually
    // decode the bytes (a mislabeled or exotic format throws here).
    let buffer: Buffer;
    try {
      buffer = await resize(sharp(file.buffer)).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException(
        'Could not process this image — the file may be corrupted or in an unsupported format',
      );
    }

    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { ...uploadOptions, resource_type: 'image', format: 'jpg' },
        (error, result) => {
          if (error || !result) {
            reject(new BadRequestException('Image upload failed — please try again'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
