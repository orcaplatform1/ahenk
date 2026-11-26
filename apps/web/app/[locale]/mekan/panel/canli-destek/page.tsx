'use client';

// Canlı Destek (mekân sahibi): yalnız mekân paneline giriş yapmış hesap; üye ekranıyla aynı bileşen
import { SupportChatScreen } from '@/components/support/SupportChatScreen';

export default function MekanCanliDestekPage() {
  return <SupportChatScreen mode="venue" />;
}
