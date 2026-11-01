import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };
export const SHARE_IMAGE_ALT = 'Ahenk | Sana Uygun İnsanlarla Buluş';

export async function renderShareImage() {
  const root = process.cwd();
  const [logo, font] = await Promise.all([
    readFile(join(root, 'public/logo.png')),
    readFile(join(root, 'assets/fonts/DMSerifDisplay-Regular.ttf')),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#121212',
          borderBottom: '12px solid #c0392b',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={280} height={280} alt="" />
        <div style={{ marginTop: 28, fontSize: 60, color: '#f5f5f5', fontFamily: 'DM Serif Display' }}>
          Sana Uygun İnsanlarla Buluş
        </div>
      </div>
    ),
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [{ name: 'DM Serif Display', data: font, weight: 400, style: 'normal' }],
    },
  );
}
