import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

const PRODUCTS_DIR = join(__dirname, '..', '..', 'uploads', 'products');
const IMAGE_SIZE = 1200;

@Injectable()
export class UploadsService {
  /**
   * Every product photo gets forced to the same IMAGE_SIZE x IMAGE_SIZE
   * square JPEG regardless of what a vendor uploads — `fit: 'cover'` crops
   * rather than letterboxes, and `position: 'attention'` lets sharp pick the
   * highest-entropy region instead of a blind center crop. This guarantees
   * uniform stored dimensions (not just uniform CSS display) and caps file
   * size for anything a vendor throws at it.
   */
  async saveProductImage(file: Express.Multer.File, originBaseUrl: string): Promise<string> {
    await mkdir(PRODUCTS_DIR, { recursive: true });

    const filename = `${randomUUID()}.jpg`;
    const outputPath = join(PRODUCTS_DIR, filename);

    // The controller only checks the browser-reported mimetype starts with
    // "image/" — sharp is the real authority on whether it can actually
    // decode the bytes (a mislabeled or exotic format throws here).
    let buffer: Buffer;
    try {
      buffer = await sharp(file.buffer)
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Could not process this image — the file may be corrupted or in an unsupported format',
      );
    }

    await writeFile(outputPath, buffer);

    return `${originBaseUrl}/uploads/products/${filename}`;
  }
}
