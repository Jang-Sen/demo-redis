import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly repository: Repository<Product>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // 생성 로직
  async createProduct(dto: CreateProductDto): Promise<Product> {
    const product = this.repository.create(dto);

    await this.repository.save(product);

    // Redis에 JSON 문자열로 저장(개별 저장)
    await this.redis.set(
      `product:${product.id}`,
      JSON.stringify(product), // 기본적으로 Redis는 문자열만 저장 가능, 객체를 저장하려면 JSON.stringify() 사용
      'EX',
      3600, // TTL(만료 시간) 설정: 3600초(1시간) 후 자동 삭제
    );
    console.log(`제품(${product.id}): Redis에 저장 - TTL 1시간`);

    // 전체 제품 목록에 ID 추가
    await this.redis.sadd('product:ids', product.id);
    await this.redis.expire('product:ids', 3600); // 1시간 후 자동 삭제
    console.log(
      `제품(${product.id}): Redis에 product:ids 안으로 저장 - TTL 1시간`,
    );

    return product;
  }

  // 전체 조회 로직(Redis 데이터 없을 경우 DB 데이터 반환 후, Redis 저장)
  async getAllProducts(): Promise<Product[]> {
    // Redis에서 전체 제품 ID 목록 가져오기
    let productIds = await this.redis.smembers('product:ids');
    console.log(
      `Redis에서 제품 ID 목록 가져오기: ${productIds.length}개 제품 ID`,
    );

    // Redis에 ID 목록이 없으면 DB에서 가져오기
    if (!productIds.length) {
      console.log('Redis에 ID 목록이 없어 DB에서 가져옵니다.');

      // DB에서 모든 제품 가져오기
      const products = await this.repository.find();

      // DB에도 제품 없으면 예외 처리
      if (!products.length) {
        console.log('DB에서 제품이 존재하지 않음');
        throw new NotFoundException('제품이 존재하지 않습니다.');
      }

      // Redis에 제품 ID 목록 저장 후, TTL 적용
      productIds = products.map((product) => product.id);
      await this.redis.sadd('product:ids', ...productIds);
      await this.redis.expire('product:ids', 3600);

      console.log(
        `레디스에 product:ids로 저장. 전체 제품 개수: ${products.length}`,
      );
    }

    // Redis에서 제품 데이터 가져오기
    console.log('Redis에서 제품 데이터를 가져옵니다.');
    const products = await Promise.all(
      productIds.map(async (id) => {
        // Redis에서 제품 정보 가져오기
        const cachedProduct = await this.redis.get(`product:${id}`);
        if (cachedProduct) {
          console.log(`제품 ${id}는 Redis에서 조회됨`);
          return JSON.parse(cachedProduct);
        }

        // Redis에 제품 정보가 없으면 DB에서 가져오기
        const product = await this.repository.findOneBy({ id });
        if (!product) {
          console.log(`제품 ${id}는 Redis에 없음, DB에서 가져옴`);
          return null;
        }

        // DB에서 가져온 제품을 Redis에 저장하고 TTL 적용
        await this.redis.set(
          `product:${id}`,
          JSON.stringify(product),
          'EX',
          3600, // 1시간 TTL
        );
        console.log(`제품 ${id}를 Redis에 저장했습니다. TTL 1시간 설정`);

        return product;
      }),
    );

    // null 값 제거 후 반환
    const validProducts = products.filter((p) => p !== null);
    console.log(`총 ${validProducts.length}개의 제품이 반환되었습니다.`);
    return validProducts;
  }

  // 조회 로직(Redis 데이터 없을 경우 DB 데이터 반환 후, Redis 저장)
  async getProduct(productId: string): Promise<Product> {
    // Redis 데이터 가져오기
    const cachedProduct = await this.redis.get(`product:${productId}`);

    // Redis 데이터가 존재할 경우 반환
    if (cachedProduct) {
      console.log('Redis 데이터 반환');
      return JSON.parse(cachedProduct);
    }

    // Redis에 데이터가 없으면 DB에서 가져오기
    const product = await this.repository.findOneBy({ id: productId });

    // 존재하지 않는 제품일 경우 에러 반환
    if (!product) {
      throw new NotFoundException('제품이 존재하지 않습니다.');
    }

    // 다시 Redis에 저장
    await this.redis.set(
      `product:${productId}`,
      JSON.stringify(product),
      'EX',
      3600,
    );

    console.log('DB 데이터 반환');
    return product;
  }

  // 삭제 로직
  async deleteProduct(productId: string): Promise<string> {
    const result = await this.repository.delete(productId);

    if (result.affected === 0) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    // Redis에서 제품 정보 삭제
    await this.redis.del(`product:${productId}`);

    // Redis에서 product:ids 목록에서 해당 ID 삭제
    await this.redis.srem('product:ids', productId);

    return '제품이 삭제되었습니다.';
  }

  // 수정 로직
  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
  ): Promise<string> {
    const result = await this.repository.update(productId, dto);

    if (result.affected === 0) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    // Redis에서 해당 제품 캐시 삭제
    await this.redis.del(`product:${productId}`);

    // 수정된 제품 정보를 Redis에 다시 저장
    const updatedProduct = await this.repository.findOneBy({ id: productId });
    if (updatedProduct) {
      await this.redis.set(
        `product:${productId}`,
        JSON.stringify(updatedProduct),
        'EX',
        3600,
      );
    }

    return '제품의 정보가 수정되었습니다.';
  }

  // 전체 조회 로직(Redis 데이터)
  async getAllProductsFromRedis(): Promise<string[]> {
    // 전체 제품 ID 목록 가져오기
    const productIds = await this.redis.smembers('product:ids');

    if (!productIds.length) {
      throw new NotFoundException('제품이 존재하지 않습니다.');
    }

    // 제품 ID 목록을 바탕으로 제품 정보 조회
    const products = await Promise.all(
      productIds.map(async (id) => {
        const product = await this.redis.get(`product:${id}`);
        return product ? JSON.parse(product) : null;
      }),
    );

    // null 값 제거 후 반환
    return products.filter((p) => p !== null);
  }

  // 조회 로직(Redis 데이터)
  async getProductFromRedis(productId: string): Promise<string> {
    // Redis에서 데이터 가져오기
    const cachedProduct = await this.redis.get(`product:${productId}`);

    if (!cachedProduct) {
      throw new NotFoundException('제품이 존재하지 않습니다.');
    }

    // JSON 형태로 변환하여 반환
    return JSON.parse(cachedProduct);
  }
}
