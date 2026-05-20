import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadsService {
  private readonly uploadsRoot: string;
  private readonly backendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.uploadsRoot = join(process.cwd(), this.config.get<string>('storage.uploadsDir') ?? 'uploads');
    this.backendUrl = (this.config.get<string>('backendUrl') ?? 'http://localhost:4000').replace(/\/$/, '');
  }

  private async ensureDir(dir: string) {
    await fs.mkdir(join(this.uploadsRoot, dir), { recursive: true });
  }

  private buildPublicUrl(relativePath: string) {
    const normalized = relativePath.replace(/\\/g, '/');
    return `${this.backendUrl}/uploads/${normalized}`;
  }

  async saveAvatar(file: Express.Multer.File) {
    await this.ensureDir('avatars');
    const extension = extname(file.originalname) || '.png';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = join(this.uploadsRoot, 'avatars', filename);
    await fs.writeFile(destination, file.buffer);

    return {
      url: this.buildPublicUrl(`avatars/${filename}`),
      path: `avatars/${filename}`,
      size: file.size,
    };
  }
}


