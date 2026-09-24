import { Injectable, BadRequestException } from '@nestjs/common';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private minioClient: Minio.Client;
  private bucket: string;

  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: process.env.STORAGE_ENDPOINT || 'localhost',
      port: parseInt(process.env.STORAGE_PORT || '9000'),
      useSSL: process.env.STORAGE_USE_SSL === 'true',
      accessKey: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
    });
    this.bucket = process.env.STORAGE_BUCKET || 'central-app';
    this.ensureBucket();
  }

  private async ensureBucket() {
    const exists = await this.minioClient.bucketExists(this.bucket);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucket, 'us-east-1');
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');

    const ext = file.originalname.split('.').pop();
    const filename = `${folder}/${uuidv4()}.${ext}`;

    await this.minioClient.putObject(
      this.bucket,
      filename,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return filename;
  }

  async getFileUrl(filename: string, expiry: number = 3600): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucket, filename, expiry);
  }

  async deleteFile(filename: string): Promise<void> {
    await this.minioClient.removeObject(this.bucket, filename);
  }
}
