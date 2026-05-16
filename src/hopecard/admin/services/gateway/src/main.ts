import { NestFactory } from '@nestjs/core';
import { Module, Controller, All, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
const httpProxy = require('express-http-proxy');
import { SERVICE_PORTS } from '@shared/constants';
import { findAvailablePort } from '@shared/port-finder';

@Controller()
export class GatewayController {
  private createProxy(target: string) {
    return httpProxy(target, {
      proxyReqPathResolver: (req: Request) => {
        const path = req.originalUrl.replace(/^\/api/, '');
        console.log(`[GATEWAY] Rewriting path to: ${path}`);
        return path;
      }
    });
  }

  private authProxy = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.AUTH}`);
  private beneficiaryProxy = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.BENEFICIARY}`);
  private approvalsProxy = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.APPROVALS}`);
  private analyticsProxy = this.createProxy(`http://127.0.0.1:${SERVICE_PORTS.ANALYTICS}`);

  @All('auth/*')
  handleAuth(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Proxying Auth request: ${req.method} ${req.url}`);
    this.authProxy(req, res);
  }

  @All('beneficiaries*')
  handleBeneficiaries(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Proxying Beneficiary request: ${req.method} ${req.url}`);
    this.beneficiaryProxy(req, res);
  }

  @All('campaigns*')
  handleCampaigns(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Proxying Campaigns request: ${req.method} ${req.url}`);
    this.beneficiaryProxy(req, res);
  }

  @All('approvals*')
  handleApprovals(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Approvals Request - Type: ${typeof req}, Method: ${req.method}`);
    console.log(`[GATEWAY] URL: ${req.url}`);
    console.log(`[GATEWAY] OriginalURL: ${req.originalUrl}`);
    console.log(`[GATEWAY] Proxying to Approvals Service...`);
    this.approvalsProxy(req, res);
  }

  @All('dashboard*')
  handleDashboard(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Proxying Dashboard request: ${req.method} ${req.url}`);
    this.analyticsProxy(req, res);
  }

  @All('activity*')
  handleActivity(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Proxying Activity request: ${req.method} ${req.url}`);
    this.analyticsProxy(req, res);
  }

  @All('health')
  handleHealth(@Req() req: Request, @Res() res: Response) {
    console.log(`[GATEWAY] Health check received: ${req.method} ${req.url}`);
    res.status(200).send({ status: 'Gateway OK' });
  }
}

@Module({
  controllers: [GatewayController],
})
class GatewayModule {}

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  
  const port = await findAvailablePort(SERVICE_PORTS.GATEWAY);
  await app.listen(port, '0.0.0.0');
  
  // Write port info for frontend discovery
  writeBackendInfo(port);
  
  console.log(`\n🚀 API Gateway running on port ${port} (Prefix: /api)`);
}

/**
 * Write backend port and URL to public/backend-info.json for frontend discovery
 */
function writeBackendInfo(port: number): void {
  try {
    // Navigate from backend/services/gateway/src to project root/public
    const backendInfoPath = path.resolve(__dirname, '../../../../public/backend-info.json');
    const backendInfo = {
      port,
      url: `http://127.0.0.1:${port}`,
      timestamp: new Date().toISOString(),
    };
    
    fs.mkdirSync(path.dirname(backendInfoPath), { recursive: true });
    fs.writeFileSync(backendInfoPath, JSON.stringify(backendInfo, null, 2));
    console.log(`📝 Backend info written to: ${backendInfoPath}`);
  } catch (error) {
    console.warn(
      `⚠️  Could not write backend info: ${error instanceof Error ? error.message : error}`
    );
  }
}

bootstrap();
