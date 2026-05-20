import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { TenantsController } from './tenants.controller';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [forwardRef(() => AuthModule)],
	controllers: [TenantsController, UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}

