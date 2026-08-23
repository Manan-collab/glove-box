import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginate } from '../../common/interfaces/paginated-result.interface';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';

@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateCarDto) {
    return this.prisma.car.create({ data: { ...dto, userId } });
  }

  async findAllForUser(userId: string, { page, pageSize }: PaginationQueryDto) {
    // Sequential, not Promise.all: @prisma/adapter-pg (Prisma 7) does not
    // support two concurrent queries on the same PrismaClient instance —
    // see https://github.com/prisma/prisma/issues/29407.
    const data = await this.prisma.car.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.car.count({ where: { userId } });
    return paginate(data, total, page, pageSize);
  }

  async findOneForUser(userId: string, carId: string) {
    const car = await this.prisma.car.findFirst({
      where: { id: carId, userId },
    });
    if (!car) {
      throw new NotFoundException('Car not found');
    }
    return car;
  }

  async update(userId: string, carId: string, dto: UpdateCarDto) {
    await this.findOneForUser(userId, carId);
    return this.prisma.car.update({ where: { id: carId }, data: dto });
  }

  async remove(userId: string, carId: string) {
    await this.findOneForUser(userId, carId);
    await this.prisma.car.delete({ where: { id: carId } });
  }
}
