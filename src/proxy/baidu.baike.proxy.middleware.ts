import { Injectable } from '@nestjs/common';
import { BaseReverseProxyMiddleware } from './base.proxy.middleware';

@Injectable()
export class BaiduBaikeProxyMiddleware extends BaseReverseProxyMiddleware {
  // 测试链接: localhost:3333/proxy/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=测试&bk_length=600
  constructor() {
    super({
      target: 'https://baike.baidu.com',
      headerKey: 'x-reverse-proxy',
      headerValue: 'BaiduBaike', // x-reverse-proxy: BaiduBaike
      urlPrefix: '/proxy',
      removeUrlPrefixWhenProxy: true,
      rateLimit: { ttl: 1, limit: 1 },
    });
  }
}
