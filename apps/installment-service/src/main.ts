import { NestFactory } from '@nestjs/core';
import { InstallmentModule } from './installment.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(InstallmentModule);
  const config = new DocumentBuilder()
    .setTitle('TMDT - Installment Service')
    .setDescription('Hệ thống quản lý trả góp - Elegance Edition')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customCss: `
      .topbar { background-color: #000000 !important; border-bottom: 2px solid #FCA311 !important; }
      .swagger-ui .info .title { color: #FCA311 !important; }
      .opblock.opblock-post { background: rgba(252, 163, 17, 0.05) !important; border-color: #FCA311 !important; }
      .opblock.opblock-get { background: rgba(20, 33, 61, 0.05) !important; border-color: #14213D !important; }
    `,
  });

  await app.listen(3008);
  console.log(`🚀 Installment Service running on: http://localhost:3008`);
  console.log(`📚 Swagger Docs (Giao diện API): http://localhost:3008/docs`);
}
bootstrap();