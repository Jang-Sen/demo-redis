import { Column, Entity } from 'typeorm';
import { Base } from './base.entity';

@Entity()
export class Product extends Base {
  @Column()
  public name: string;

  @Column()
  public price: number;

  @Column()
  public description: string;

  @Column()
  public category: string;

  @Column({ nullable: true })
  public productImg?: string;
}
