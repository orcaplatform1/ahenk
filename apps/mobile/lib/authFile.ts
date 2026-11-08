// Yetkili dosya açma (admin): dosya Authorization: Bearer ile önbelleğe indirilir ve uygulama içinde önizlenir
// (iOS Quick Look: görsel, PDF, video). Tarayıcı açılmaz; token URL'ye eklenmez.
import { Directory, File, Paths } from 'expo-file-system';
import { refreshAtLaunch } from './api';
import { getAccess } from './session';

async function download(url: string): Promise<File> {
  const token = await getAccess();
  const dir = new Directory(Paths.cache, 'admin-files', String(Date.now()));
  dir.create({ intermediates: true, idempotent: true });
  return File.downloadFileAsync(url, dir, { headers: token ? { Authorization: `Bearer ${token}` } : {}, idempotent: true });
}

export async function openAuthedFile(url: string): Promise<void> {
  let file: File;
  try { file = await download(url); }
  catch {
    // Erişim token'ı süresi dolmuş olabilir: bir kez yenileyip tekrar dene
    if ((await refreshAtLaunch()) !== 'ok') throw new Error('Dosya indirilemedi.');
    file = await download(url);
  }
  if (!(await file.canPreview())) throw new Error('Bu dosya önizlenemiyor.');
  await file.preview();
}
