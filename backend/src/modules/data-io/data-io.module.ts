import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { DataIoController } from './data-io.controller';
import { DataIoService } from './data-io.service';

@Module({
  imports: [CarsModule, ExpensesModule],
  controllers: [DataIoController],
  providers: [DataIoService],
})
export class DataIoModule {}
