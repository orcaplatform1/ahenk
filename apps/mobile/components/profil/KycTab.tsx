// apps/web/app/profil/tabs/TabKyc.tsx karşılığı. Kimlik fotoğrafı yalnız kamerayla (S-12), canlılık videosu ön kamera
// (3 sn geri sayım + 5 sn kayıt). Kayıt sırasında pencere kapatılamaz (S-25). Yükleme: POST /kyc/upload (multipart).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { SvgUri } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { API_PREFIX, SITE } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { BtnGhost, BtnPrimary, Card, SkeletonBlock, T, Title } from '../ui';
import { c, ll, tw, tw4 } from '@/theme/theme';

interface KycStatus { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS' | null; rejectReason?: string | null }
interface Shot { uri: string }

function Done({ label, onRetake }: { label: string; onRetake: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' }}>
      <T style={{ fontSize: 16, color: tw4.green400 }}>✓</T>
      <T style={{ fontSize: 12, color: tw4.green400 }}>{label}</T>
      <BtnGhost label="Tekrar Çek" style={{ marginLeft: 'auto' }} onPress={onRetake} />
    </View>
  );
}

export function PhotoCamera({ visible, onClose, onShot }: { visible: boolean; onClose: () => void; onShot: (s: Shot) => void }) {
  const insets = useSafeAreaInsets();
  const ref = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  useEffect(() => { if (visible && perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [visible, perm, requestPerm]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? <CameraView ref={ref} style={{ flex: 1 }} facing="back" /> : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><T style={{ color: tw.accent, textAlign: 'center' }}>Kamera izni reddedildi. Ayarlar → Ahenk → Kamera bölümünden izin verin.</T></View>
        )}
        <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 16 + insets.bottom }}>
          <BtnGhost label="Vazgeç" style={{ flex: 1 }} onPress={onClose} />
          <BtnPrimary label="Çek" style={{ flex: 1 }} disabled={!perm?.granted} onPress={async () => { const p = await ref.current?.takePictureAsync({ quality: 0.85 }); if (p?.uri) { onShot({ uri: p.uri }); onClose(); } }} />
        </View>
      </View>
    </Modal>
  );
}

function ImageUploader({ svg, alt, label, shot, onChange }: { svg: string; alt: string; label: string; shot: Shot | null; onChange: (s: Shot | null) => void }) {
  const [cam, setCam] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      {!shot ? (
        <View style={{ width: '100%', maxWidth: 260, maxHeight: 160, aspectRatio: 85 / 54, alignSelf: 'center', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', opacity: 0.6 }} accessibilityLabel={alt}>
          <SvgUri uri={`${SITE}${svg}`} width="100%" height="100%" />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        </View>
      ) : <Image source={{ uri: shot.uri }} style={{ width: '100%', height: 220, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} resizeMode="cover" accessibilityLabel="Önizleme" />}
      {shot ? <Done label="Fotoğraf Yüklendi" onRetake={() => onChange(null)} /> : <BtnGhost label={label} full onPress={() => setCam(true)} />}
      <PhotoCamera visible={cam} onClose={() => setCam(false)} onShot={onChange} />
    </View>
  );
}

function LivenessRecorder({ video, onCapture }: { video: Shot | null; onCapture: (s: Shot | null) => void }) {
  const insets = useSafeAreaInsets();
  const ref = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [phase, setPhase] = useState<'idle' | 'preview' | 'countdown' | 'recording' | 'error'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [recCountdown, setRecCountdown] = useState(5);
  const [camError, setCamError] = useState('');

  async function openCamera() {
    setCamError('');
    const cp = camPerm?.granted ? camPerm : await requestCam();
    const mp = micPerm?.granted ? micPerm : await requestMic();
    if (!cp.granted || !mp.granted) { setCamError('Kamera izni reddedildi. Ayarlar → Ahenk bölümünden kamera ve mikrofon izni verin.'); setPhase('error'); return; }
    setPhase('preview');
  }
  function startRecording() {
    setPhase('countdown'); setCountdown(3);
    let r = 3;
    const tick = setInterval(() => {
      r -= 1; setCountdown(r);
      if (r <= 0) {
        clearInterval(tick);
        setPhase('recording'); setRecCountdown(5);
        let rr = 5;
        const recTick = setInterval(() => { rr -= 1; setRecCountdown(rr); if (rr <= 0) clearInterval(recTick); }, 1000);
        ref.current?.recordAsync({ maxDuration: 5 }).then((v) => {
          if (v?.uri) onCapture({ uri: v.uri });
          setPhase('idle');
        }).catch((e: Error) => { setCamError(`Kamera açılamadı: ${e.message}`); setPhase('error'); });
      }
    }, 1000);
  }
  const live = phase === 'preview' || phase === 'countdown' || phase === 'recording';

  return (
    <View style={{ gap: 12 }}>
      <Modal visible={live} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (phase === 'preview') setPhase('idle'); }}>
        <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
          <View style={{ flex: 1 }}>
            <CameraView ref={ref} style={{ flex: 1 }} facing="front" mode="video" />
            {phase === 'countdown' && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <T w={700} style={{ fontSize: 72, color: c.red, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{countdown}</T>
              </View>
            )}
            {phase === 'recording' && (
              <View style={{ position: 'absolute', top: 12, left: 12, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.green }} />
                  <T w={700} style={{ fontSize: 10, color: '#2ecc71' }}>KAYIT BAŞLADI</T>
                </View>
                <T w={700} style={{ fontSize: 18, color: '#2ecc71', lineHeight: 18 }}>{recCountdown}</T>
              </View>
            )}
          </View>
          {phase === 'preview' && (
            <View style={{ padding: 16, gap: 12 }}>
              <T style={{ fontSize: 12, textAlign: 'center', color: '#2ecc71' }}>Kayıt başladığında 5 sn. içinde adınızı ve soyadınızı söyleyin.</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <BtnGhost label="Vazgeç" style={{ flex: 1 }} onPress={() => setPhase('idle')} />
                <BtnPrimary label="Kaydı Başlat" style={{ flex: 1 }} onPress={startRecording} />
              </View>
            </View>
          )}
        </View>
      </Modal>
      {phase === 'error' && !!camError && (
        <View style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(192,57,43,0.1)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.3)' }}>
          <T style={{ fontSize: 14, color: tw.accent }}>{camError}</T>
        </View>
      )}
      {video ? <Done label="Video Yüklendi" onRetake={() => onCapture(null)} /> : (
        <>
          <Image source={require('@/assets/kyc-liveness-demo.png')} style={{ width: '100%', height: 180, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }} resizeMode="cover" accessibilityLabel="Canlı video örneği" />
          <BtnGhost label="Canlı Video Yükle" full onPress={openCamera} />
          <View style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.3)' }}>
            <T style={{ fontSize: 12, color: 'rgba(192,57,43,0.85)', lineHeight: 19.2 }}>
              Ekibimiz hesap doğrulama talebinizi inceleyene kadar bilgiler saklanır. Doğrulama onaylanır veya reddedilir ise, tüm bilgiler veritabanından silinir ve depolanmaz. Doğrulama, sahte profillerin platformu kullanmasını engellemek için bir filtredir.
            </T>
          </View>
        </>
      )}
    </View>
  );
}

async function uploadKyc(front: Shot, back: Shot, video: Shot, onProgress: (p: number) => void) {
  const token = await getAccess();
  const form = new FormData();
  const ext = video.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
  form.append('idFront', { uri: front.uri, name: 'idFront.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('idBack', { uri: back.uri, name: 'idBack.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('liveness', { uri: video.uri, name: `liveness.${ext}`, type: ext === 'mov' ? 'video/quicktime' : 'video/mp4' } as unknown as Blob);
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_PREFIX}/kyc/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else { try { reject(new Error(JSON.parse(xhr.responseText)?.message ?? `Hata (${xhr.status})`)); } catch { reject(new Error(`Yükleme başarısız (${xhr.status})`)); } }
    };
    xhr.onerror = () => reject(new Error('Ağ hatası'));
    xhr.send(form);
  });
}

// Web .kyc-ball / @keyframes ballRoll: 12 px top, translateX(-120px) → (genişlik + 40px), 3 sn doğrusal, 0/1/2 sn gecikmeli üç top
function KycBalls() {
  const [w, setW] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [w, v]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 36, width: '100%', overflow: 'hidden' }}>
      {w > 0 && [0, 1, 2].map(i => {
        const shift = i / 3; // gecikme 0/1/2 sn = döngünün 0, 1/3, 2/3'ü
        const p = v.interpolate({ inputRange: [0, 1], outputRange: [1 - shift, 2 - shift] });
        const x = Animated.modulo(p, 1).interpolate({ inputRange: [0, 1], outputRange: [-120, w + 40] });
        return <Animated.View key={i} style={{ position: 'absolute', top: 12, left: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: c.kycBall, transform: [{ translateX: x }] }} />;
      })}
    </View>
  );
}

export function KycTab({ onApproved }: { onApproved?: () => void }) {
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [front, setFront] = useState<Shot | null>(null);
  const [back, setBack] = useState<Shot | null>(null);
  const [video, setVideo] = useState<Shot | null>(null);

  useEffect(() => {
    api.get<KycStatus>('/kyc/status').then((s) => { setStatus(s); if (s?.status === 'APPROVED') onApproved?.(); })
      .catch((e: Error) => {
        if (e.message.includes('404') || e.message.toLowerCase().includes('bulunamadı')) setStatus({ status: 'PENDING' });
        else if (e.message === '__rate_limit__') setError('Çok fazla istek gönderildi. Lütfen sayfayı yeniden yükleyin.');
        else setError(e.message);
      }).finally(() => setLoading(false));
  }, [onApproved]);

  async function submit() {
    if (!front || !back || !video) { setError('Tüm alanları doldurun ve liveness videosu kaydedin.'); return; }
    setSubmitting(true); setError('');
    try { await uploadKyc(front, back, video, setProgress); setStatus({ status: 'PENDING' }); setFront(null); setBack(null); setVideo(null); setProgress(0); }
    catch (e) { setError((e as Error).message); } finally { setSubmitting(false); }
  }

  if (loading) return <SkeletonBlock lines={4} />;
  if (error && !status) return <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>;
  if (status?.status === 'APPROVED') {
    return (
      <Card style={{ alignItems: 'center', gap: 12 }}>
        <T style={{ fontSize: 30 }}>✓</T>
        <T w={500} style={{ fontSize: 16, color: tw4.green400 }}>Kimliğiniz doğrulandı</T>
        <T style={{ fontSize: 13, color: ll.label, textAlign: 'center' }}>Artık masalara katılabilir ve paket satın alabilirsiniz.</T>
      </Card>
    );
  }
  if (status?.status === 'PENDING') {
    return (
      <Card style={{ alignItems: 'center', gap: 16, paddingTop: 0, paddingBottom: 32, paddingHorizontal: 0, overflow: 'hidden' }}>
        <KycBalls />
        <T w={600} style={{ fontSize: 16, paddingHorizontal: 24, textAlign: 'center' }}>Doğrulama incelemeye alındı</T>
        <T style={{ fontSize: 13, color: ll.label, paddingHorizontal: 24, textAlign: 'center' }}>Başvurunuz değerlendiriliyor.{'\n'}Bu süreç genellikle 1 saat içinde tamamlanır.</T>
      </Card>
    );
  }
  return (
    <View style={{ gap: 20 }}>
      {status?.status === 'REJECTED' && (
        <View style={{ backgroundColor: tw4.red900a20, borderWidth: 1, borderColor: tw4.red800, borderRadius: 16, padding: 16 }}>
          <T w={500} style={{ fontSize: 14, color: tw.accent, marginBottom: 4 }}>Başvurunuz reddedildi</T>
          <T style={{ fontSize: 13, color: ll.label }}>{status.rejectReason ?? 'Lütfen belgelerinizi yeniden yükleyin.'}</T>
        </View>
      )}
      <Title>Kimlik Doğrulama</Title>
      <ImageUploader svg="/kyc_demo_identity_card.svg" alt="Kimlik ön yüz örneği" label="Ön Yüzü Yükle" shot={front} onChange={setFront} />
      <ImageUploader svg="/kyc_demo_identity_card_back.svg" alt="Kimlik arka yüz örneği" label="Arka Yüzü Yükle" shot={back} onChange={setBack} />
      <LivenessRecorder video={video} onCapture={setVideo} />
      {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
      <BtnPrimary label={submitting ? 'Yükleniyor…' : 'Kimliğimi Doğrula'} full disabled={submitting || !front || !back || !video} style={(submitting || !front || !back || !video) ? { opacity: 0.5 } : undefined} onPress={submit} />
      {submitting && progress > 0 && (
        <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.10)' }}>
          <LinearGradient colors={['#1a5c2a', '#27ae60']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${progress}%` }} />
        </View>
      )}
    </View>
  );
}
