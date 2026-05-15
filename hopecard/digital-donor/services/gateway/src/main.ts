import '@shared/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, All, Req, Res, UseGuards, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
const httpProxy = require('express-http-proxy');
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';
import { HttpExceptionFilter, AllExceptionsFilter } from '@shared/http-exception.filter';

class JwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Missing token');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, anonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new UnauthorizedException('Invalid token');
    req.headers['x-user-id'] = user.id;
    return true;
  }
}

@Controller()
export class GatewayController {
  private createProxy(target: string) {
    return httpProxy(target, {
      proxyReqPathResolver: (req: Request) => req.originalUrl.replace(/^\/api/, ''),
    });
  }

  private authProxy      = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.AUTH}`);
  private campaignsProxy = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.CAMPAIGNS}`);
  private cartProxy      = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.CART}`);
  private purchasesProxy = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.PURCHASES}`);
  private profileProxy   = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.PROFILE}`);

  // Public — no JWT
  @All('auth/*')
  handleAuth(@Req() req: Request, @Res() res: Response) {
    this.authProxy(req, res, (err: any) => { if (err) res.status(502).json({ error: 'Auth service unavailable' }); });
  }

  // Public — campaigns are read-only and browsable without auth
  @All('campaigns*')
  handleCampaigns(@Req() req: Request, @Res() res: Response) {
    this.campaignsProxy(req, res, (err: any) => { if (err) res.status(502).json({ error: 'Campaigns service unavailable' }); });
  }

  @All('cart*')
  @UseGuards(JwtGuard)
  handleCart(@Req() req: Request, @Res() res: Response) {
    this.cartProxy(req, res, (err: any) => { if (err) res.status(502).json({ error: 'Cart service unavailable' }); });
  }

  @All('purchases*')
  @UseGuards(JwtGuard)
  handlePurchases(@Req() req: Request, @Res() res: Response) {
    this.purchasesProxy(req, res, (err: any) => { if (err) res.status(502).json({ error: 'Purchases service unavailable' }); });
  }

  @All('profile*')
  @UseGuards(JwtGuard)
  handleProfile(@Req() req: Request, @Res() res: Response) {
    this.profileProxy(req, res, (err: any) => { if (err) res.status(502).json({ error: 'Profile service unavailable' }); });
  }

  @All('impact*')
  @UseGuards(JwtGuard)
  handleImpact(@Req() req: Request, @Res() res: Response) {
    this.profileProxy(req, res, (err: any) => { if (err) res.status(502).json({ error: 'Profile service unavailable' }); });
  }

  @All('health')
  handleHealth(@Req() _req: Request, @Res() res: Response) {
    res.status(200).json({ status: 'Gateway OK' });
  }
}

@Module({ controllers: [GatewayController] })
class GatewayModule {}

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  const port = await findAvailablePort(SERVICE_PORTS.GATEWAY);
  await app.listen(port, '0.0.0.0');
  writeBackendInfo(port);
  console.log(`\n🚀 Gateway running on port ${port}`);
}

function writeBackendInfo(port: number): void {
  try {
    // From backend/services/gateway/src/ → 4 levels up = project root → apps/frontend/public/
    const dest = path.resolve(__dirname, '../../../../apps/frontend/public/backend-info.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify({
      port,
      url: `http://127.0.0.1:${port}`,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    console.warn('Could not write backend-info.json:', e);
  }
}

bootstrap();
