import { Controller, Post, Get, Body, Headers, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, BootstrapDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('setup-status')
  setupStatus() {
    return this.authService.setupStatus();
  }

  @Post('bootstrap')
  @HttpCode(200)
  bootstrap(@Body() dto: BootstrapDto) {
    return this.authService.bootstrap(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Headers('x-station-id') stationId: string,
  ) {
    if (!stationId) throw new BadRequestException('X-Station-Id header is required');
    return this.authService.login(dto, stationId);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout() {
    // JWT is stateless — client drops token; response confirms success
    return { success: true };
  }
}
