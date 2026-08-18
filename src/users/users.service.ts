import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { User } from '../entities/user.entity';
import { UsersQueryDto } from './dto/users-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Same lookup used by JwtStrategy on every request — includes the vendor
   * relation so RBAC/ownership checks downstream don't need a second query
   * just to find out whether this user has a vendor profile. */
  findByIdWithVendor(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id }, relations: ['vendor'] });
  }

  create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  /** Full-entity save — AVOID this for a request-scoped `user` object that
   * came from `@CurrentUser()`/JwtStrategy, since that object carries a
   * loaded `vendor` relation which may now be stale (e.g. right after a
   * caller just created that very Vendor row elsewhere in the same
   * request). TypeORM's save() re-syncs loaded relations against what's on
   * the entity, so a stale `vendor: null` gets written back as a real NULL
   * to `vendors.user_id`, breaking the NOT NULL constraint. Use
   * `updateRole`/other targeted `.update()` calls instead when only a
   * scalar column is changing. */
  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  async updateRole(userId: string, role: User['role']): Promise<void> {
    await this.usersRepository.update(userId, { role });
  }

  getRepository(): Repository<User> {
    return this.usersRepository;
  }

  // ------------------------------------------------------------- admin

  async adminFindAll(query: UsersQueryDto): Promise<PaginatedResult<User>> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, query.page, query.limit);
  }

  async adminDeactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.softRemove(user);
  }

  async adminReactivate(id: string): Promise<User> {
    await this.usersRepository.restore(id);
    return this.findById(id);
  }
}
