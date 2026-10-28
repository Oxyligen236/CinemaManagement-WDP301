import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkSchedule, WorkScheduleDocument } from '../domain/schemas/work-schedule.schema';
import { Branch, BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';

@Injectable()
export class WorkScheduleService {
  constructor(
    @InjectModel(WorkSchedule.name) private readonly scheduleModel: Model<WorkScheduleDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
  ) {}

  async create(input: CreateWorkScheduleDto) {
    if (!(await this.branchModel.exists({ branchId: input.branchId }))) throw new NotFoundException('Không tìm thấy chi nhánh');
    const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = toMinutes(input.startTime);
    const end = toMinutes(input.endTime);
    const durationInMinutes = end > start ? end - start : 1440 - start + end;
    if (durationInMinutes <= 0 || durationInMinutes > 600) throw new BadRequestException('Ca làm phải dài hơn 0 và không quá 10 giờ');
    if (await this.scheduleModel.exists({ branchId: input.branchId, shiftName: input.shiftName, startTime: input.startTime, endTime: input.endTime })) throw new ConflictException('Ca làm đã tồn tại');
    return this.scheduleModel.create({ ...input, durationInMinutes, isOvernight: end <= start, userIds: [] });
  }

  list(branchId?: string) { return this.scheduleModel.find(branchId ? { branchId } : {}).sort({ startTime: 1 }).lean().exec(); }
}
