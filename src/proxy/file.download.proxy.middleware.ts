import { Injectable } from '@nestjs/common';
import { BaseReverseProxyMiddleware } from './base.proxy.middleware';

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
