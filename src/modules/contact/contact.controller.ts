import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { BookDemoDto } from './dto/book-demo.dto';
import { ContactSalesDto } from './dto/contact-sales.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('book-demo')
  bookDemo(@Body() dto: BookDemoDto) {
    return this.contactService.bookDemo(dto);
  }

  @Post('sales')
  contactSales(@Body() dto: ContactSalesDto) {
    return this.contactService.contactSales(dto);
  }
}

