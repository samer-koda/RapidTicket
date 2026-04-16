import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../database/entities/category.entity';
import { MenuItem } from '../database/entities/menu-item.entity';
import { Modifier } from '../database/entities/modifier.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { CreateModifierDto, UpdateModifierDto } from './dto/modifier.dto';
import { MenuItemType } from '../database/entities/menu-item.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(MenuItem)
    private readonly itemRepo: Repository<MenuItem>,
    @InjectRepository(Modifier)
    private readonly modifierRepo: Repository<Modifier>,
  ) {}

  // ── Categories ──────────────────────────────────────────────────────────────

  getCategories() {
    return this.categoryRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createCategory(dto: CreateCategoryDto) {
    const cat = this.categoryRepo.create({ ...dto, sortOrder: dto.sortOrder ?? 0 });
    return this.categoryRepo.save(cat);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    Object.assign(cat, dto);
    return this.categoryRepo.save(cat);
  }

  async deleteCategory(id: string) {
    const cat = await this.categoryRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat.items?.length) {
      throw new ConflictException(
        'Cannot delete a category that has menu items assigned to it',
      );
    }
    await this.categoryRepo.remove(cat);
    return { success: true };
  }

  // ── Menu Items ───────────────────────────────────────────────────────────────

  async getItems(filters: { categoryId?: string; type?: MenuItemType }) {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.modifiers', 'modifier')
      .orderBy('item.sortOrder', 'ASC')
      .addOrderBy('modifier.sortOrder', 'ASC');

    if (filters.categoryId) {
      qb.andWhere('item.category_id = :categoryId', { categoryId: filters.categoryId });
    }
    if (filters.type) {
      qb.andWhere('item.type = :type', { type: filters.type });
    }

    return qb.getMany();
  }

  async createItem(dto: CreateMenuItemDto) {
    const cat = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException('Category not found');

    const item = this.itemRepo.create({ ...dto, sortOrder: dto.sortOrder ?? 0 });
    return this.itemRepo.save(item);
  }

  async updateItem(id: string, dto: UpdateMenuItemDto) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');

    if (dto.categoryId) {
      const cat = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundException('Category not found');
    }

    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async deleteItem(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    // Per spec: only allowed if no order history. We check order_items references.
    const orderItemCount = await this.itemRepo.manager
      .getRepository('order_items')
      .count({ where: { menu_item_id: id } } as never);

    if (orderItemCount > 0) {
      throw new ConflictException(
        'Cannot delete item with order history — set isAvailable to false instead',
      );
    }

    await this.itemRepo.remove(item);
    return { success: true };
  }

  // ── Global Modifier Library ─────────────────────────────────────────────────

  getAllModifiers() {
    return this.modifierRepo.find({ order: { sortOrder: 'ASC', label: 'ASC' } });
  }

  async createModifier(dto: CreateModifierDto) {
    const mod = this.modifierRepo.create({ ...dto, sortOrder: dto.sortOrder ?? 0 });
    return this.modifierRepo.save(mod);
  }

  async updateModifier(modifierId: string, dto: UpdateModifierDto) {
    const mod = await this.modifierRepo.findOne({ where: { id: modifierId } });
    if (!mod) throw new NotFoundException('Modifier not found');
    Object.assign(mod, dto);
    return this.modifierRepo.save(mod);
  }

  async deleteModifier(modifierId: string) {
    const mod = await this.modifierRepo.findOne({ where: { id: modifierId } });
    if (!mod) throw new NotFoundException('Modifier not found');
    await this.modifierRepo.remove(mod);
    return { success: true };
  }

  // ── Item ↔ Modifier assignment ──────────────────────────────────────────────

  async getItemModifiers(menuItemId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: menuItemId },
      relations: ['modifiers'],
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item.modifiers;
  }

  async assignModifier(menuItemId: string, modifierId: string) {
    const [item, mod] = await Promise.all([
      this.itemRepo.findOne({ where: { id: menuItemId }, relations: ['modifiers'] }),
      this.modifierRepo.findOne({ where: { id: modifierId } }),
    ]);
    if (!item) throw new NotFoundException('Menu item not found');
    if (!mod) throw new NotFoundException('Modifier not found');
    if (!item.modifiers.find(m => m.id === modifierId)) {
      item.modifiers.push(mod);
      await this.itemRepo.save(item);
    }
    return { success: true };
  }

  async unassignModifier(menuItemId: string, modifierId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: menuItemId },
      relations: ['modifiers'],
    });
    if (!item) throw new NotFoundException('Menu item not found');
    item.modifiers = item.modifiers.filter(m => m.id !== modifierId);
    await this.itemRepo.save(item);
    return { success: true };
  }
}
