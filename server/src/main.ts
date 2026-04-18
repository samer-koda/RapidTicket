import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as os from 'os';

function getLanAddress(): string | null {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (!addr.internal && addr.family === 'IPv4') return addr.address;
    }
  }
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: '*' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);

  const lan = getLanAddress();
  const logger = new Logger('Bootstrap');
  logger.log(`Server listening on port ${port}`);
  logger.log(`Local:   http://localhost:${port}`);
  if (lan) logger.log(`Network: http://${lan}:${port}`);
}
bootstrap();

