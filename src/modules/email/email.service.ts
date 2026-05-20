import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Resend } = require('resend');
type ResendClient = any;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendClient: ResendClient | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('email.apiKey');
    if (apiKey) {
      this.resendClient = new Resend(apiKey);
    } else {
      this.logger.warn('EMAIL_API_KEY is not configured. Emails will be logged instead of sent.');
      this.resendClient = null;
    }
  }

  async sendTenantInvite(email: string, password: string, inviteToken: string, landlordName: string) {
    const frontendUrl = (this.config.get<string>('frontendUrl') ?? '').replace(/\/$/, '');
    const inviteUrl = `${frontendUrl}/tenant/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0F2D3F 0%, #1FB9C9 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to RentEase</h1>
          </div>
          <div style="background: white; padding: 40px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              You've been invited by <strong>${landlordName}</strong> to join RentEase as a tenant.
            </p>
            <div style="background: #F3F5F7; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="margin: 0 0 10px 0; font-weight: 600;">Your temporary password:</p>
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1FB9C9; font-family: monospace;">${password}</p>
            </div>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Please use this password to complete your account setup. You can change it after logging in.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="display: inline-block; background: #1FB9C9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 24px; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #1FB9C9; word-break: break-all;">${inviteUrl}</a>
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              This invitation will expire in 7 days.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>This email was sent by RentEase. If you didn't expect this invitation, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to RentEase

You've been invited by ${landlordName} to join RentEase as a tenant.

Your temporary password: ${password}

Please use this password to complete your account setup. You can change it after logging in.

Accept your invitation: ${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, please ignore this email.
    `;

    await this.deliverEmail(email, 'Welcome to RentEase - Tenant Invitation', html, text);
  }

  async sendPropertyManagerInvite(email: string, password: string, inviteToken: string, landlordName: string) {
    const frontendUrl = (this.config.get<string>('frontendUrl') ?? '').replace(/\/$/, '');
    const inviteUrl = `${frontendUrl}/property-manager/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0F2D3F 0%, #1FB9C9 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to RentEase</h1>
          </div>
          <div style="background: white; padding: 40px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
            <p style="font-size: 16px; margin-bottom: 20px">
              You've been invited by <strong>${landlordName}</strong> to join RentEase as a Property Manager.
            </p>
            <div style="background: #F3F5F7; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="margin: 0 0 10px 0; font-weight: 600;">Your temporary password:</p>
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1FB9C9; font-family: monospace;">${password}</p>
            </div>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Please use this password to complete your account setup. You can change it after logging in.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="display: inline-block; background: #1FB9C9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 24px; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #1FB9C9; word-break: break-all;">${inviteUrl}</a>
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              This invitation will expire in 7 days.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>This email was sent by RentEase. If you didn't expect this invitation, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to RentEase

You've been invited by ${landlordName} to join RentEase as a Property Manager.

Your temporary password: ${password}

Please use this password to complete your account setup. You can change it after logging in.

Accept your invitation: ${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, please ignore this email.
    `;

    await this.deliverEmail(email, 'Welcome to RentEase - Property Manager Invitation', html, text);
  }

  async sendLandlordWelcome(email: string, companyName: string) {
    const dashboardUrl = (this.config.get<string>('frontendUrl') ?? '').replace(/\/$/, '') + '/landlord/login?registered=true';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0F2D3F 0%, #1FB9C9 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to RentEase</h1>
            <p style="color: white; margin: 10px 0 0;">We're excited to support ${companyName}.</p>
          </div>
          <div style="background: white; padding: 40px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${companyName},</p>
            <p style="font-size: 16px; margin-bottom: 16px;">
              Your landlord workspace is ready. Invite tenants, configure rent automations, and monitor collections from one dashboard.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background: #1FB9C9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 24px; font-weight: 600; font-size: 16px;">
                Open dashboard
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              Need help onboarding? Reply to this email or visit the help center.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to RentEase

Hi ${companyName},

Your landlord workspace is live. Visit your dashboard to invite tenants and start automating rent:
${dashboardUrl}

Need help? Reply to this email anytime.
    `;

    await this.deliverEmail(email, 'Welcome to RentEase', html, text);
  }

  async sendEmail(to: string, subject: string, html: string, text: string) {
    return this.deliverEmail(to, subject, html, text);
  }

  private async deliverEmail(to: string, subject: string, html: string, text: string) {
    const from = this.config.get<string>('email.from');

    if (!this.resendClient) {
      this.logger.warn(`Skipping email to ${to} because Resend client is not configured.`);
      this.logger.debug(`Subject: ${subject} | Preview: ${text.substring(0, 120)}...`);
      return;
    }

    try {
      await this.resendClient.emails.send({
        from,
        to,
        subject,
        html,
        text,
      });
      this.logger.log(`Sent email to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

