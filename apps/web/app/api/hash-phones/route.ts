import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { phones } = await req.json() as { phones: string[] };
  if (!Array.isArray(phones)) return NextResponse.json({ hashes: [] });
  const hashes = phones.map((p) => createHash('sha256').update(p).digest('hex'));
  return NextResponse.json({ hashes });
}
