import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JantiHaydarAdminController, JantiHaydarController } from './janti-haydar.controller';
import { JantiHaydarService } from './janti-haydar.service';
import { InstagramService } from './instagram.service';

@Module({
  imports: [AuthModule],
  controllers: [JantiHaydarController, JantiHaydarAdminController],
  providers: [JantiHaydarService, InstagramService],
})
export class JantiHaydarModule {}
