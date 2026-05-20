import { IsArray, IsUUID } from 'class-validator';

export class AssignPropertyDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  propertyIds!: string[];
}

