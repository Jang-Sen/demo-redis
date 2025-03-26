import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: '제품 생성 API' })
  @ApiConsumes('application/x-www-form-urlencoded')
  async createProduct(@Body() dto: CreateProductDto): Promise<Product> {
    return await this.productService.createProduct(dto);
  }

  @Get()
  @ApiOperation({ summary: '제품 전체 조회 API' })
  async getAllProducts() {
    return await this.productService.getAllProducts();
  }

  @Get('/redis')
  @ApiOperation({ summary: 'Redis 데이터 제품 전체 조회 API' })
  async getAllProductsFromRedis() {
    return await this.productService.getAllProductsFromRedis();
  }

  @Get('/:id')
  @ApiOperation({ summary: '제품 조회 API' })
  async getProduct(@Param('id') id: string) {
    return await this.productService.getProduct(id);
  }

  @Get('/redis/:id')
  @ApiOperation({ summary: 'Redis 데이터 제품 조회 API' })
  async getProductFromRedis(@Param('id') id: string) {
    return await this.productService.getProductFromRedis(id);
  }
}
