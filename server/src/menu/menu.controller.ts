import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { MenuService } from './menu.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { CreateModifierDto, UpdateModifierDto } from './dto/modifier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MenuItemType } from '../database/entities/menu-item.entity';

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ── Categories ──────────────────────────────────────────────────────────────

  @Get('categories')
  getCategories() {
    return this.menuService.getCategories();
  }

  @Post('categories')
  @Roles('admin')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles('admin')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles('admin')
  @HttpCode(200)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.deleteCategory(id);
  }

  // ── Menu Items ───────────────────────────────────────────────────────────────

  @Get('items')
  getItems(
    @Query('categoryId') categoryId?: string,
    @Query('type') type?: MenuItemType,
  ) {
    return this.menuService.getItems({ categoryId, type });
  }

  @Post('items')
  @Roles('admin')
  createItem(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createItem(dto);
  }

  @Patch('items/:id')
  @Roles('admin')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @Roles('admin')
  @HttpCode(200)
  deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.deleteItem(id);
  }

  // ── Global Modifier Library ─────────────────────────────────────────────────

  @Get('modifiers')
  getAllModifiers() {
    return this.menuService.getAllModifiers();
  }

  @Post('modifiers')
  @Roles('admin')
  createModifier(@Body() dto: CreateModifierDto) {
    return this.menuService.createModifier(dto);
  }

  @Patch('modifiers/:modifierId')
  @Roles('admin')
  updateModifier(
    @Param('modifierId', ParseUUIDPipe) modifierId: string,
    @Body() dto: UpdateModifierDto,
  ) {
    return this.menuService.updateModifier(modifierId, dto);
  }

  @Delete('modifiers/:modifierId')
  @Roles('admin')
  @HttpCode(200)
  deleteModifier(@Param('modifierId', ParseUUIDPipe) modifierId: string) {
    return this.menuService.deleteModifier(modifierId);
  }

  // ── Item ↔ Modifier assignment ──────────────────────────────────────────────

  @Get('items/:id/modifiers')
  getItemModifiers(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.getItemModifiers(id);
  }

  @Post('items/:id/modifiers/:modifierId')
  @Roles('admin')
  @HttpCode(200)
  assignModifier(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('modifierId', ParseUUIDPipe) modifierId: string,
  ) {
    return this.menuService.assignModifier(id, modifierId);
  }

  @Delete('items/:id/modifiers/:modifierId')
  @Roles('admin')
  @HttpCode(200)
  unassignModifier(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('modifierId', ParseUUIDPipe) modifierId: string,
  ) {
    return this.menuService.unassignModifier(id, modifierId);
  }

  // ── Item images ──────────────────────────────────────────────────────────────

  @Post('items/:id/image')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  uploadItemImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new NotFoundException('No file uploaded');
    return this.menuService.uploadItemImage(id, file.buffer, file.mimetype);
  }

  @Get('items/:id/image')
  @Public()
  async getItemImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.menuService.getItemImage(id);
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }

  @Delete('items/:id/image')
  @Roles('admin')
  @HttpCode(200)
  deleteItemImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.deleteItemImage(id);
  }

  // ── Category images ──────────────────────────────────────────────────────────

  @Post('categories/:id/image')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  uploadCategoryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new NotFoundException('No file uploaded');
    return this.menuService.uploadCategoryImage(id, file.buffer, file.mimetype);
  }

  @Get('categories/:id/image')
  @Public()
  async getCategoryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.menuService.getCategoryImage(id);
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }

  @Delete('categories/:id/image')
  @Roles('admin')
  @HttpCode(200)
  deleteCategoryImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.deleteCategoryImage(id);
  }
}
