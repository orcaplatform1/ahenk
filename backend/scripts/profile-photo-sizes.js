// Mevcut profil fotoğraflarını iki boyuta dönüştürür (bir kez çalıştırılır; tekrar çalıştırmak zararsız):
// p-<zaman>-<rastgele>.webp → uzun kenar 1080 px (aynı ad), p-<zaman>-<rastgele>.s.webp → uzun kenar 200 px.
// Kullanım: cd backend && node scripts/profile-photo-sizes.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIR = path.join(process.cwd(), "..", "uploads", "profile-photos");
const Q = 82; // common/image-webp.ts WEBP_QUALITY
const resize = (buf, px) => sharp(buf).resize({ width: px, height: px, fit: "inside", withoutEnlargement: true }).webp({ quality: Q }).toBuffer();

(async () => {
  let done = 0;
  if (!fs.existsSync(DIR)) { console.log("klasör yok"); return; }
  for (const user of fs.readdirSync(DIR)) {
    const ud = path.join(DIR, user);
    if (!fs.statSync(ud).isDirectory()) continue;
    for (const f of fs.readdirSync(ud)) {
      if (!/^p-\d+-[a-f0-9]{12}\.webp$/.test(f)) continue;
      const fp = path.join(ud, f);
      const buf = fs.readFileSync(fp);
      const [large, small] = await Promise.all([resize(buf, 1080), resize(buf, 200)]);
      fs.writeFileSync(fp, large);
      fs.writeFileSync(path.join(ud, f.replace(/\.webp$/, ".s.webp")), small);
      done++;
    }
  }
  console.log(`dönüştürülen: ${done}`);
})().catch((e) => { console.error(e); process.exit(1); });
