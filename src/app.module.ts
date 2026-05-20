import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { LeasesModule } from './modules/leases/leases.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PropertyManagersModule } from './modules/property-managers/property-managers.module';
import { ContactModule } from './modules/contact/contact.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    PropertiesModule,
    LeasesModule,
    InvoicesModule,
    PaymentsModule,
    ReceiptsModule,
    ExpensesModule,
    ComplaintsModule,
    NotificationsModule,
    SubscriptionsModule,
    PropertyManagersModule,
    ContactModule,
    UploadsModule,
  ],
})
export class AppModule {}

