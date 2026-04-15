import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvalidImageTypeException, ImageTooLargeException } from '../common/exceptions/review.exceptions';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly maxSizeBytes: number;
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    const maxMb = config.get<number>('app.maxImageSizeMb') ?? 5;
    this.maxSizeBytes = maxMb * 1024 * 1024;
    this.uploadDir = path.join(process.cwd(), 'uploads', 'reviews');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadReviewImages(files: Express.Multer.File[], userId: string): Promise<string[]> {
    const urls = await Promise.all(files.map((file) => this.uploadSingle(file, userId)));
    return urls;
  }

  private validateFile(file: Express.Multer.File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new InvalidImageTypeException(file.originalname);
    }
    if (file.size > this.maxSizeBytes) {
      throw new ImageTooLargeException(file.originalname);
    }
  }

  private async uploadSingle(file: Express.Multer.File, userId: string): Promise<string> {
    this.validateFile(file);

    const ext = file.mimetype === 'image/webp' ? 'webp' : file.mimetype === 'image/png' ? 'png' : 'jpg';
    const filename = `${userId}-${Date.now()}-${uuidv4()}.${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filepath, file.buffer);
    this.logger.log(`Saved review image: ${filename}`);

    // Return a relative URL — replace with CDN URL in production
    return `/uploads/reviews/${filename}`;
  }
}
