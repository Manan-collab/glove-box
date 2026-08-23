import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SafeUser } from '../auth/utils/to-safe-user';
import { DataIoService } from './data-io.service';
import { ImportResultDto } from './dto/import-result.dto';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

@ApiTags('data-io')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('data-io')
export class DataIoController {
  constructor(private readonly dataIoService: DataIoService) {}

  @Get('export')
  async export(@CurrentUser() user: SafeUser, @Res() res: Response) {
    const buffer = await this.dataIoService.exportWorkbook(user.id);
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="glovebox-export-${date}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('template')
  async template(@Res() res: Response) {
    const buffer = await this.dataIoService.buildTemplate();
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition':
        'attachment; filename="glovebox-import-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: ImportResultDto })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }),
  )
  async import(
    @CurrentUser() user: SafeUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    return this.dataIoService.importWorkbook(user.id, file.buffer);
  }
}
