import { Controller, Get, Post, Param, Query, Body, Req, Header } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { RequirePersona } from '@app/common';

@RequirePersona('donor', 'hopecard')
@Controller('hopecard/donor/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post('checkout')
  createCheckout(
    @Req() req: any,
    @Body() body: { authUserId?: string; buyerAuthId?: string; successBaseUrl?: string; successUrl?: string; cancelUrl?: string },
  ) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? req.user?.sub ?? '';
    const host = req.headers.host || 'localhost:3104';
    const protocol = req.secure ? 'https' : 'http';
    
    const defaultSuccessUrl = `${protocol}://${host}/api/v1/hopecard/donor/purchases/payment/success`;
    const defaultCancelUrl = `${protocol}://${host}/api/v1/hopecard/donor/purchases/payment/cancel`;
    
    const successBaseUrl = body.successBaseUrl ?? body.successUrl ?? defaultSuccessUrl;
    const cancelUrl = body.cancelUrl ?? defaultCancelUrl;
    
    return this.purchasesService.createCheckoutSession(authUserId, successBaseUrl, cancelUrl);
  }

  @Get('payment/success')
  @Header('Content-Type', 'text/html')
  async paymentSuccess(
    @Query('redirectUrl') redirectUrl?: string,
    @Query('ref') ref?: string,
    @Query('buyerAuthId') buyerAuthId?: string,
  ) {
    let paymentDetails = null;
    if (buyerAuthId && ref) {
      try {
        paymentDetails = await this.purchasesService.confirmPurchase(buyerAuthId, '', ref);
      } catch (err) {
        console.error('Auto-confirmation error in paymentSuccess:', err);
      }
    }
    
    const amountStr = paymentDetails ? String(paymentDetails.totalAmount) : '';
    let targetUrl = redirectUrl || 'digdonmobile://confirmation';
    if (amountStr) {
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${separator}amount=${encodeURIComponent(amountStr)}`;
      if (ref) {
        targetUrl = `${targetUrl}&transactionId=${encodeURIComponent(ref)}`;
      }
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting...</title>
          <meta http-equiv="refresh" content="0; url=${targetUrl}" />
          <script>
            window.location.href = "${targetUrl}";
          </script>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #FFF8F7; color: #97453E;">
          <div style="max-width: 480px; margin: 0 auto; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid rgba(151,69,62,0.05);">
            <div style="width: 72px; height: 72px; border-radius: 36px; background: rgba(151,69,62,0.05); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
              <span style="font-size: 36px;">🎉</span>
            </div>
            <h2 style="margin-top: 0; color: #97453E;">Payment Successful!</h2>
            
            ${paymentDetails ? `
              <div style="margin: 24px 0; padding: 16px; background: #FFFDFD; border-radius: 12px; border: 1px solid rgba(151,69,62,0.1);">
                <div style="font-size: 14px; color: #877270; margin-bottom: 4px;">Amount Paid</div>
                <div style="font-size: 28px; font-weight: 800; color: #97453E;">₱${paymentDetails.totalAmount.toLocaleString()}</div>
                ${paymentDetails.processingFee > 0 ? `
                  <div style="font-size: 11px; color: #A59290; margin-top: 4px;">Incl. ₱${paymentDetails.processingFee} processing fee</div>
                ` : ''}
              </div>
            ` : ''}

            <p style="color: #877270; font-size: 14px; line-height: 1.5;">Redirecting you back to the HOPECARD app...</p>
            <p style="font-size: 12px; color: #A59290; margin-top: 20px;">
              If you are not redirected, <a href="${targetUrl}" style="color: #F28D83; font-weight: bold; text-decoration: none;">click here to return</a>.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  @Get('payment/cancel')
  @Header('Content-Type', 'text/html')
  paymentCancel(@Query('redirectUrl') redirectUrl?: string) {
    const targetUrl = redirectUrl || 'digdonmobile://wallet';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting...</title>
          <meta http-equiv="refresh" content="0; url=${targetUrl}" />
          <script>
            window.location.href = "${targetUrl}";
          </script>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #FFF8F7; color: #97453E;">
          <h2>Payment Cancelled</h2>
          <p>Redirecting you back to the HOPECARD app...</p>
          <p>If you are not redirected, <a href="${targetUrl}" style="color: #F28D83; font-weight: bold;">click here to return</a>.</p>
        </body>
      </html>
    `;
  }

  @Get('checkout/:checkoutId')
  getCheckout(@Param('checkoutId') checkoutId: string) {
    return this.purchasesService.getCheckoutSession(checkoutId);
  }

  @Post('checkout/:checkoutId/cancel')
  cancelCheckout(@Param('checkoutId') checkoutId: string) {
    return this.purchasesService.cancelCheckoutSession(checkoutId);
  }

  @Post('confirm')
  confirmPurchase(@Req() req: any, @Body() body: { authUserId?: string; buyerAuthId?: string; checkoutId?: string; referenceId?: string }) {
    const authUserId = body.authUserId ?? body.buyerAuthId ?? req.user?.sub ?? '';
    const checkoutId = body.checkoutId ?? '';
    const referenceId = body.referenceId ?? '';
    return this.purchasesService.confirmPurchase(authUserId, checkoutId, referenceId);
  }

  @Get()
  getPurchases(@Req() req: any, @Query('authUserId') authUserId?: string) {
    const userId = authUserId || req.user?.sub;
    return this.purchasesService.getPurchases(userId);
  }
}
