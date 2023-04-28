import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { PassThrough } from 'stream';
import * as zlib from 'zlib';
import { RequestHandler } from 'express';
import { JsonUtils } from '../utils/json';

export interface ReverseProxyOptions {
  target: string;
  headerKey?: string;
  headerValue: string;
  urlPrefix?: string;
  removeUrlPrefixWhenProxy?: boolean;
  extraHeaders?: string[]; //例：['headerkey1:headervalue1', 'headerkey2:headervalue2']
  rateLimit?: ReverseProxyRateLimitOptions;
  ssl?: boolean;
  timeout?: number;
  bufferSize?: number;
  logRequest?: boolean;
  logResponse?: boolean;
}

const DEFAULT_HEADER_KEY = 'x-reverse-proxy';
const DEFAULT_TIMEOUT: number = 60 * 1000;
const DEFAULT_BUFFER: number = 16 * 1024;

export interface ReverseProxyRateLimitOptions {
  ttl: number;
  limit: number;
}

@Injectable()
export class BaseReverseProxyMiddleware implements NestMiddleware {
  private proxy: RequestHandler;
  private limiter: RateLimitRequestHandler;
  @Inject(WINSTON_MODULE_PROVIDER) protected readonly logger: Logger;

  constructor(private readonly options: ReverseProxyOptions) {
    // 创建一个代理对象，指定目标服务器和其他选项
    this.proxy = this.createProxyMiddleware(options);

    if (this.options.rateLimit) {
      // 创建限流器
      this.limiter = this.createRateLimter(options);
    }
  }

  use(req: any, res: any, next: () => void) {
    // 如果 urlPrefix 不匹配，输出日志并返回。
    if (
      this.options.urlPrefix &&
      !req.originalUrl.startsWith(this.options.urlPrefix)
    ) {
      this.logger.info(
        `[${this.constructor.name}]: URL prefix not match ${this.options.urlPrefix} originalUrl: ${req.originalUrl}`,
      );
      next();
      return;
    }

    // 如果 header 不匹配，输出日志并返回。
    if (
      this.options.headerValue !==
      req.headers[this.options.headerKey ?? DEFAULT_HEADER_KEY]
    ) {
      this.logger.info(
        `[${this.constructor.name}]: Request header not match: ${
          this.options.headerKey
        }:${this.options.headerValue}, Request headers: ${JsonUtils.stringify(
          req.headers,
        )}`,
      );
      next();
      return;
    }

    if (this.limiter) {
      this.limiter(req, res, () => {
        this.proxy(req, res, next);
      });
    } else {
      this.proxy(req, res, next);
    }
  }

  createProxyMiddleware(options) {
    return createProxyMiddleware({
      target: options.target, // 目标服务器地址
      changeOrigin: true, // 修改请求头中的host为目标服务器的host
      ssl: this.options.ssl,
      buffer: new PassThrough({
        highWaterMark: this.options.bufferSize ?? DEFAULT_BUFFER,
      }),
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      proxyTimeout: options.timeout ?? DEFAULT_TIMEOUT,
      onError: (e, req, res, target) => {
        this.logErrorAndReturn500(e, req, res, target);
      },
      pathRewrite: (path) => {
        if (!options.removeUrlPrefixWhenProxy) {
          return path;
        }
        return path.replace(options.urlPrefix, '');
      },
      onProxyReq: (proxyReq, req, res, options) => {
        // 添加自定义 header
        if (this.options.extraHeaders) {
          for (const header of this.options.extraHeaders) {
            const headerKeyValue = header.split(':');
            req.headers[headerKeyValue[0].trim()] = headerKeyValue[1].trim();
          }
        }
        this.logRequestInfo(req);
        this.handleRequestBodyBeforeSend(proxyReq, req, res);
      },
      //selfHandleResponse: true, // 设置为true表示由我们自己处理响应内容
      onProxyRes: (proxyRes, req, res) => {
        this.logResponseAndHandleGzipData(proxyRes, req);
      },
    });
  }

  createRateLimter(options) {
    return rateLimit({
      standardHeaders: true,
      windowMs: options.rateLimit.ttl * 1000,
      max: options.rateLimit.limit, // limit each IP requests per windowMs
      handler: function (req, res) {
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests, please try again later.',
        });
      },
    });
  }

  handleRequestBodyBeforeSend(proxyReq, req, res) {
    if (String(req.method).toLowerCase() === 'get' || !req.body) {
      proxyReq.end();
      return;
    }

    if (String(req.headers['content-type']).toLowerCase().includes('json')) {
      const body = JsonUtils.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
      proxyReq.write(body);
      proxyReq.end();
    } else if (
      String(req.headers['content-type'])
        .toLowerCase()
        .includes('x-www-form-urlencoded')
    ) {
      proxyReq.setHeader('content-length', Buffer.byteLength(req.rawBody));
      proxyReq.write(req.rawBody);
      proxyReq.end();
    } else if (
      String(req.headers['content-type'])
        .toLowerCase()
        .includes('multipart/form-data')
    ) {
      // 处理文件上传
      let buffer = Buffer.alloc(0);
      req.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
      });
      req.on('end', () => {
        proxyReq.setHeader('content-length', buffer.length);
        proxyReq.write(buffer);
        proxyReq.end();
      });
    } else {
      proxyReq.end();
    }
  }

  logErrorAndReturn500(e, req, res, target) {
    this.logger.error(
      `[${
        this.constructor.name
      }] Proxy onError: target:${target}, error:${JsonUtils.stringify(e)}`,
    );
    if (res.headersSent) {
      return;
    }
    this.logger.error(
      `[${this.constructor.name}] Proxy onError: headerSent:${
        res.headerSent
      }, statusCode:500, target:${target}, error:${JsonUtils.stringify(e)}`,
    );
    // custom error handler
    res.status(500).json({
      statusCode: 500,
      message: JsonUtils.stringify(e),
    });
  }

  logResponseAndHandleGzipData(proxyRes, req) {
    if (this.options.logResponse !== undefined && !this.options.logResponse) {
      return;
    }
    let body = Buffer.alloc(0, 1024, 'utf-8');
    const encoding = proxyRes.headers['content-encoding'];
    const isGzipped = encoding === 'gzip';

    proxyRes.on('data', (chunk) => {
      body = Buffer.concat([body, chunk]);
    });

    const logResponse = () => {
      this.logger.info(
        `[${this.constructor.name}] Response [${req.method}] ${
          this.options.target
        }${
          req.url ?? ''
        } Response body: ${body.toLocaleString()}, Response headers: ${JsonUtils.stringify(
          proxyRes.headers,
        )}`,
      );
    };
    proxyRes.on('end', () => {
      if (isGzipped) {
        zlib.gunzip(body, (err, decoded) => {
          if (err) {
            this.logger.error(
              `[${this.constructor.name}] Error decoding gzip response: ${err}`,
            );
            return;
          }
          body = decoded;
          logResponse();
        });
      } else {
        logResponse();
      }
    });
  }

  logRequestInfo(req) {
    if (this.options.logRequest !== undefined && !this.options.logRequest) {
      return;
    }
    // 开始代理，打印日志
    this.logger.info(
      `[${this.constructor.name}] Request [${req.method}] ${req.headers.host}${
        req.originalUrl
      } -> ${this.options.target}${req.url}, Request raw body: ${
        req.rawBody
      }, Request body: ${JsonUtils.stringify(
        req.body,
      )}, Request headers: ${JsonUtils.stringify(req.headers)}`,
    );
  }
}
