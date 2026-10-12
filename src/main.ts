import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  createOpenApiDocument,
  enablePublicCors,
  setupSwaggerUi,
} from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  enablePublicCors(app);
  const document = createOpenApiDocument(app, [
    { url: `http://localhost:${port}`, description: 'Development server' },
  ]);
  setupSwaggerUi(app, document);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api`,
  );
}
bootstrap();
