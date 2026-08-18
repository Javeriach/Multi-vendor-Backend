import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '../common/utils/slugify';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({
      relations: ['children'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { slug },
      relations: ['children', 'parent'],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (await this.categoriesRepository.exist({ where: { slug } })) {
      throw new ConflictException(`Category slug "${slug}" already exists`);
    }

    const parent = dto.parentId ? await this.findOne(dto.parentId) : null;

    const category = this.categoriesRepository.create({
      name: dto.name,
      slug,
      imageUrl: dto.imageUrl ?? null,
      backgroundColor: dto.backgroundColor ?? null,
      parent,
    });
    return this.categoriesRepository.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.imageUrl !== undefined) category.imageUrl = dto.imageUrl;
    if (dto.backgroundColor !== undefined) category.backgroundColor = dto.backgroundColor;
    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      const existing = await this.categoriesRepository.findOne({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category slug "${slug}" already exists`);
      }
      category.slug = slug;
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }
      category.parent = dto.parentId ? await this.findOne(dto.parentId) : null;
    }

    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    // Relies on the DB-level FK RESTRICT on products.category_id and
    // categories.parent_id — this delete simply surfaces that as a clean
    // 409 via the global exception filter rather than a raw SQL error.
    await this.categoriesRepository.remove(category);
  }
}
