import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @ApiProperty({ example: '아이코스 3세대', description: '제품명' })
  name: string;

  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ type: 'number', example: 69900, description: '제품 가격' })
  price: number;

  @IsString()
  @ApiProperty({
    example: '기존 기능에서 더 진화된 아이코스',
    description: '제품 설명',
  })
  description: string;

  @IsString()
  @ApiProperty({ example: '권렬형', description: '제품 종류' })
  category: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: '제품 사진', default: '' })
  productImg?: string;
}
