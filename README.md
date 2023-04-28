## Description

A [nestjs](https://docs.nestjs.com/) reverse proxy implementation + winston logger.
一个基于 [nestjs](https://docs.nestjs.com/) 的反向代理实现 + winston 日志输出。

## Installation

```bash
npm install -g pnpm
pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## How to use

- Create your proxy class extends BaseReverseProxyMiddleware(src/proxy/base.proxy.middleware.ts) and set your proxy options. 创建你的代理类继承 BaseReverseProxyMiddleware（src/proxy/base.proxy.middleware.ts）并设置相关参数即可

```javascript
// Examples
// src/proxy/baidu.baike.proxy.middleware.ts
@Injectable()
export class BaiduBaikeProxyMiddleware extends BaseReverseProxyMiddleware {
  constructor() {
    super({
      target: 'https://baike.baidu.com',
      headerKey: 'x-reverse-proxy',
      headerValue: 'BaiduBaike',
      urlPrefix: '/proxy',
      removeUrlPrefixWhenProxy: true,
      rateLimit: { ttl: 1, limit: 1 },
    });
  }
}

// src/proxy/file.download.proxy.middleware.ts
@Injectable()
export class FileDownloadProxyMiddleware extends BaseReverseProxyMiddleware {
  constructor() {
    super({
      target: 'http://www.nlc.cn',
      urlPrefix: '/proxy',
      headerKey: 'x-reverse-proxy',
      headerValue: 'file-download',
      removeUrlPrefixWhenProxy: true,
      bufferSize: 64 * 1024,
      logResponse: false,
      rateLimit: { ttl: 1, limit: 1 },
    });
  }
}
```

- Register your proxy to AppModule(src/app.module.ts). 注册你创建的代理类到  AppModule(src/app.module.ts)
  
```javascript
@Module({ imports: [WinstonModule.forRoot(createAppLoggerOptions())] })
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BaiduBaikeProxyMiddleware, FileDownloadProxyMiddleware)
      .forRoutes('/proxy/');
  }
}
```

Test 测试

- BaiduBaikeProxyMiddleware:

  ```bash
  curl -H x-reverse-proxy:BaiduBaike 'http://localhost:3000/proxy/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=test&bk_length=600'
  ```

- FileDownloadProxyMiddleware:

  ```bash
  curl -H x-reverse-proxy:file-download http://localhost:3000/proxy/upload/img/2023-02-15/931a96c3.jpeg > file.jpeg
  ```

## License

[MIT licensed](LICENSE)
