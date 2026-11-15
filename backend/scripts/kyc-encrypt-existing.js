// Diskteki şifresiz KYC dosyalarını AES-256-GCM ile şifreler (src/kyc/kyc-crypto.ts ile aynı biçim; bir kez çalıştırılır,
// tekrar çalıştırmak zararsızdır: .enc dosyalar atlanır).
// Her dosya: şifreli kopya "<dosya>.enc" yazılır → kopya çözülüp orijinalle bayt bayt karşılaştırılır → aynıysa veritabanındaki
// yol .enc'e çevrilir ve şifresiz orijinal silinir; değilse orijinal silinmez, başarısız sayılır.
// Kullanım: cd backend && node scripts/kyc-encrypt-existing.js
require("dotenv/config");
const fs = require("fs");
const path = require("path");
const { createCipheriv, createDecipheriv, randomBytes } = require("crypto");
// pg, Prisma adaptörünün bağımlılığı olarak kurulu (pnpm): adaptörün yanından çözülür
const { Client } = require(require.resolve("pg", { paths: [path.dirname(require.resolve("@prisma/adapter-pg"))] }));

const DIR = path.join(process.cwd(), "..", "uploads", "kyc");
const MAGIC = Buffer.from("AHKKYC01", "ascii");
const hex = process.env.KYC_ENCRYPTION_KEY || "";
if (!/^[0-9a-f]{64}$/i.test(hex)) { console.error("KYC_ENCRYPTION_KEY geçersiz"); process.exit(1); }
const KEY = Buffer.from(hex, "hex");

function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}
function decrypt(data) {
  if (!data.subarray(0, 8).equals(MAGIC)) throw new Error("biçim");
  const d = createDecipheriv("aes-256-gcm", KEY, data.subarray(8, 20));
  d.setAuthTag(data.subarray(20, 36));
  return Buffer.concat([d.update(data.subarray(36)), d.final()]);
}

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let ok = 0, failed = 0;
  const failures = [];
  if (!fs.existsSync(DIR)) { console.log("klasör yok"); await db.end(); return; }
  for (const user of fs.readdirSync(DIR)) {
    const ud = path.join(DIR, user);
    if (user === ".tmp" || !fs.statSync(ud).isDirectory()) continue;
    for (const f of fs.readdirSync(ud)) {
      const fp = path.join(ud, f);
      if (f.endsWith(".enc") || !fs.statSync(fp).isFile()) continue;
      const enc = fp + ".enc";
      try {
        const plain = fs.readFileSync(fp);
        fs.writeFileSync(enc, encrypt(plain));
        const back = decrypt(fs.readFileSync(enc));
        if (!back.equals(plain)) throw new Error("karşılaştırma farklı");
        for (const col of ["idFrontKey", "idBackKey", "livenessKey"]) {
          await db.query(`UPDATE "KycSubmission" SET "${col}" = $1 WHERE "${col}" = $2`, [enc, fp]);
        }
        fs.unlinkSync(fp);
        ok++;
      } catch (e) {
        failed++;
        failures.push(`${path.relative(DIR, fp)}: ${e.message}`);
      }
    }
  }
  await db.end();
  console.log(`şifrelenen: ${ok}`);
  console.log(`başarısız: ${failed}`);
  for (const x of failures) console.log(`  - ${x}`);
})().catch((e) => { console.error(e); process.exit(1); });
