import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module';
import { DataIoController } from './data-io.controller';
import { DataIoService } from './data-io.service';

@Module({
  imports: [CarsModule],
  controllers: [DataIoController],
  providers: [DataIoService],
})
export class DataIoModule {}
