import { MiddlewareConsumer, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { createAppLoggerOptions } from './proxy/proxy.logger.options';
import { BaiduBaikeProxyMiddleware } from './proxy/baidu.baike.proxy.middleware';
import { FileDownloadProxyMiddleware } from './proxy/file.download.proxy.middleware';

@Module({ imports: [WinstonModule.forRoot(createAppLoggerOptions())] })
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BaiduBaikeProxyMiddleware, FileDownloadProxyMiddleware)
      .forRoutes('/proxy/');
  }
}
