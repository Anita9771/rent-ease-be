import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { BookDemoDto } from './dto/book-demo.dto';
import { ContactSalesDto } from './dto/contact-sales.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly emailService: EmailService) {}

  async bookDemo(dto: BookDemoDto) {
    this.logger.log(`Demo booking request from ${dto.email}`);

    // Send notification email to internal team
    const demoEmailContent = `
      <h2>New Demo Booking Request</h2>
      <p><strong>Name:</strong> ${dto.name}</p>
      <p><strong>Email:</strong> ${dto.email}</p>
      ${dto.company ? `<p><strong>Company:</strong> ${dto.company}</p>` : ''}
      ${dto.phone ? `<p><strong>Phone:</strong> ${dto.phone}</p>` : ''}
      ${dto.preferredDate ? `<p><strong>Preferred Date:</strong> ${dto.preferredDate}</p>` : ''}
      ${dto.preferredTime ? `<p><strong>Preferred Time:</strong> ${dto.preferredTime}</p>` : ''}
      ${dto.message ? `<p><strong>Additional Notes:</strong><br>${dto.message}</p>` : ''}
    `;

    // TODO: Replace with actual internal email address
    const internalEmail = process.env.INTERNAL_EMAIL || 'hello@rentease.com';
    await this.emailService.sendEmail(
      internalEmail,
      `New Demo Booking: ${dto.name}`,
      demoEmailContent,
      `New Demo Booking Request\n\nName: ${dto.name}\nEmail: ${dto.email}\nCompany: ${dto.company || 'N/A'}\nPhone: ${dto.phone || 'N/A'}\nPreferred Date: ${dto.preferredDate || 'N/A'}\nPreferred Time: ${dto.preferredTime || 'N/A'}\nMessage: ${dto.message || 'N/A'}`,
    ).catch(error => {
      this.logger.error(`Failed to send demo booking email:`, error);
    });

    // Send confirmation email to requester
    const confirmationContent = `
      <h2>Thank you for booking a demo!</h2>
      <p>Hi ${dto.name},</p>
      <p>We've received your request for a concierge demo. Our team will contact you within 24 hours to schedule your demo.</p>
      ${dto.preferredDate ? `<p>Your preferred date: ${dto.preferredDate}${dto.preferredTime ? ` at ${dto.preferredTime}` : ''}</p>` : ''}
      <p>If you have any questions in the meantime, feel free to reply to this email.</p>
      <p>Best regards,<br>The RentEase Team</p>
    `;

    await this.emailService.sendEmail(
      dto.email,
      'Demo Booking Confirmation - RentEase',
      confirmationContent,
      `Thank you for booking a demo!\n\nHi ${dto.name},\n\nWe've received your request for a concierge demo. Our team will contact you within 24 hours to schedule your demo.\n\nBest regards,\nThe RentEase Team`,
    ).catch(error => {
      this.logger.error(`Failed to send confirmation email to ${dto.email}:`, error);
    });

    return { success: true, message: 'Demo booking request submitted successfully' };
  }

  async contactSales(dto: ContactSalesDto) {
    this.logger.log(`Sales inquiry from ${dto.email} (${dto.company})`);

    // Send notification email to sales team
    const salesEmailContent = `
      <h2>New Sales Inquiry</h2>
      <p><strong>Name:</strong> ${dto.name}</p>
      <p><strong>Email:</strong> ${dto.email}</p>
      <p><strong>Company:</strong> ${dto.company}</p>
      ${dto.phone ? `<p><strong>Phone:</strong> ${dto.phone}</p>` : ''}
      ${dto.units ? `<p><strong>Number of Units:</strong> ${dto.units}</p>` : ''}
      ${dto.message ? `<p><strong>Message:</strong><br>${dto.message}</p>` : ''}
    `;

    // TODO: Replace with actual sales email address
    const salesEmail = process.env.SALES_EMAIL || 'sales@rentease.com';
    await this.emailService.sendEmail(
      salesEmail,
      `New Sales Inquiry: ${dto.company}`,
      salesEmailContent,
      `New Sales Inquiry\n\nName: ${dto.name}\nEmail: ${dto.email}\nCompany: ${dto.company}\nPhone: ${dto.phone || 'N/A'}\nUnits: ${dto.units || 'N/A'}\nMessage: ${dto.message || 'N/A'}`,
    ).catch(error => {
      this.logger.error(`Failed to send sales inquiry email:`, error);
    });

    // Send confirmation email to requester
    const confirmationContent = `
      <h2>Thank you for your interest!</h2>
      <p>Hi ${dto.name},</p>
      <p>We've received your inquiry about RentEase Enterprise. Our sales team will contact you within 24 hours to discuss your needs.</p>
      <p>In the meantime, feel free to explore our features or reach out if you have any questions.</p>
      <p>Best regards,<br>The RentEase Sales Team</p>
    `;

    await this.emailService.sendEmail(
      dto.email,
      'Sales Inquiry Received - RentEase',
      confirmationContent,
      `Thank you for your interest!\n\nHi ${dto.name},\n\nWe've received your inquiry about RentEase Enterprise. Our sales team will contact you within 24 hours to discuss your needs.\n\nBest regards,\nThe RentEase Sales Team`,
    ).catch(error => {
      this.logger.error(`Failed to send confirmation email to ${dto.email}:`, error);
    });

    return { success: true, message: 'Sales inquiry submitted successfully' };
  }
}

