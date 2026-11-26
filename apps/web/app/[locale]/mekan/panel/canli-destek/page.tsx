'use client';

// Canlı Destek (mekân sahibi): yalnız mekân paneline giriş yapmış hesap; üye ekranıyla aynı bileşen
import { useRouter } from '@/i18n/navigation';
import { SupportChatScreen } from '@/components/support/SupportChatScreen';

export default function MekanCanliDestekPage() {
  const router = useRouter();
  return <SupportChatScreen mode="venue" onMinimize={() => { if (window.history.length > 1) router.back(); else router.push('/mekan/panel/bilgiler'); }} />;
}
