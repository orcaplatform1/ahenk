import { Module } from "@nestjs/common";
import { TestController } from "./test.controller";
import { TestService } from "./test.service";
import { TestCompletedGuard } from "./test.guard";

@Module({
  controllers: [TestController],
  providers: [TestService, TestCompletedGuard],
  exports: [TestService, TestCompletedGuard],
})
export class TestModule {}
