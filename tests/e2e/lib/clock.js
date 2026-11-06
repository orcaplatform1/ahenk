// Simüle edilmiş saatle çalışan in-process backend (:port). Sunucu saatine dokunmaz; sadece bu sürecin Date'i değişir.
process.env.BULL_PREFIX = 'ahenk-test-clock';
const h = require('./h');
const FakeTimers = require('@sinonjs/fake-timers');
let clock, app;
const tr = (s) => new Date(s + '+03:00'); // tr('2027-01-07T11:59:00')
function setNow(s) { const t = typeof s === 'string' ? tr(s) : s; if (!clock) clock = FakeTimers.install({ toFake: ['Date'], now: t }); else clock.setSystemTime(t); }
async function boot(port = 4101) {
  const { NestFactory } = h.bk('@nestjs/core'); const { ValidationPipe } = h.bk('@nestjs/common');
  const cookieParser = h.bk('cookie-parser');
  const { AppModule } = require(h.BACK + '/dist/src/app.module');
  app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  app.use(cookieParser()); app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(port, '127.0.0.1');
  h.setBase(`http://127.0.0.1:${port}`);
  return app;
}
const svc = (path, name) => app.get(require(h.BACK + '/dist/src/' + path)[name], { strict: false });
async function drain(ms = 300) { // assign kuyruğunu boşalt
  const { getQueueToken } = h.bk('@nestjs/bull'); const q = app.get(getQueueToken('matching-assign'), { strict: false });
  for (let i = 0; i < 200; i++) { const c = await q.getJobCounts(); if (!c.waiting && !c.active) break; await h.sleep(30); }
  await h.sleep(ms > 50 ? 50 : ms);
}
async function shutdown() { await app.close().catch(() => {}); clock?.uninstall(); await h.prisma.$disconnect(); }
module.exports = { boot, setNow, tr, svc, drain, shutdown };
