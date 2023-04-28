import { Injectable } from '@nestjs/common';
import { BaseReverseProxyMiddleware } from './base.proxy.middleware';

/**
 * @author wulong-tea (WangQi)
 * 2023-04-28
 */
@Injectable()
export class BaiduBaikeProxyMiddleware extends BaseReverseProxyMiddleware {
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
