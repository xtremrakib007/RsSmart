import { Controller, Post, Delete, Body, Param, UseGuards, UploadedFile, UseInterceptors, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { CurrentUser } from '../common/decorators/user.decorator';

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post(':folder')
  @ApiOperation({ summary: 'Upload file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('folder') folder: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    // Phase 24: scope every uploaded object to the caller's tenant
    const tenantScopedFolder = `tenants/${user.tenantId}/${folder}`;
    const filename = await this.uploadService.uploadFile(file, tenantScopedFolder);
    const url = await this.uploadService.getFileUrl(filename);
    return { filename, url };
  }

  @Post('url')
  @ApiOperation({ summary: 'Get presigned URL for file' })
  async getFileUrl(@Body('filename') filename: string, @CurrentUser() user: any) {
    this.enforceTenantOwnership(filename, user.tenantId);
    const url = await this.uploadService.getFileUrl(filename);
    return { filename, url };
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete file' })
  async deleteFile(@Param('filename') filename: string, @CurrentUser() user: any) {
    this.enforceTenantOwnership(filename, user.tenantId);
    await this.uploadService.deleteFile(filename);
    return { message: 'File deleted' };
  }

  private enforceTenantOwnership(filename: string, tenantId: string) {
    const expectedPrefix = `tenants/${tenantId}/`;
    if (!filename.startsWith(expectedPrefix)) {
      throw new ForbiddenException('Access denied to this file');
    }
  }
}
