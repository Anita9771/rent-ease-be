import { Module, forwardRef } from '@nestjs/common';
import { PropertyManagersController } from './property-managers.controller';
import { PropertyManagersService } from './property-managers.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => AuthModule), EmailModule, NotificationsModule],
  controllers: [PropertyManagersController],
  providers: [PropertyManagersService],
  exports: [PropertyManagersService],
})
export class PropertyManagersModule {}

