import { IsArray, IsString, ArrayUnique } from 'class-validator';
export class AssignWorkScheduleDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) userIds!: string[];
}
