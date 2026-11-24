// apps/web/app/profil/tabs/TabKyc.tsx karşılığı. Önce belge türü sorulur (Kimlik Kartı / Ehliyet / Pasaport / Oturma İzni; bölge
// ayarından), sonra çekim: Pasaport'ta yalnız fotoğraflı sayfa, diğerlerinde önce ön yüz, ardından arka yüz. Belge fotoğrafı yalnız kamerayla (S-12), canlılık videosu ön kamera
// (3 sn geri sayım + 5 sn kayıt). Kayıt sırasında pencere kapatılamaz (S-25). Yükleme: POST /kyc/upload (multipart).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { PERM_REASON, showSettingsAlert } from '@/lib/permissions';
import { SvgUri } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { API_PREFIX, SITE } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { StdButton, Card, SkeletonBlock, T, Title } from '../ui';
import { c, ll, tw, tw4 } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import i18n, { currentLang } from '@/lib/i18n';

import { KYC_DOC_TYPES, type KycDocType } from '@ahenk/shared';
export type IdType = KycDocType;
const ID_TYPES: IdType[] = KYC_DOC_TYPES;

interface KycStatus { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS' | null; rejectReason?: string | null }
interface Shot { uri: string }

function Done({ label, onRetake }: { label: string; onRetake: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' }}>
      <T style={{ fontSize: 16, color: tw4.green400 }}>✓</T>
      <T style={{ fontSize: 12, color: tw4.green400 }}>{label}</T>
      <StdButton variant="ghost" label={t('kycf.retake')} style={{ marginLeft: 'auto' }} onPress={onRetake} />
    </View>
  );
}

export function PhotoCamera({ visible, onClose, onShot }: { visible: boolean; onClose: () => void; onShot: (s: Shot) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ref = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  useEffect(() => { if (visible && perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [visible, perm, requestPerm]);
  // Kamera izni kalıcı reddedilmişse: neden gerektiği + "Ayarlara Git"
  const blockedShown = useRef(false);
  useEffect(() => {
    if (!visible) { blockedShown.current = false; return; }
    if (perm && !perm.granted && !perm.canAskAgain && !blockedShown.current) { blockedShown.current = true; showSettingsAlert(PERM_REASON.kycCamera); }
  }, [visible, perm]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? <CameraView ref={ref} style={{ flex: 1 }} facing="back" /> : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><T style={{ color: tw.accent, textAlign: 'center' }}>{t('kycf.camDeniedApp')}</T></View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 16 + insets.bottom }}>
          <StdButton variant="ghost" label={t('kycf.cancel')} style={{ flex: 1 }} onPress={onClose} />
          <StdButton variant="primary" label={t('kycf.shoot')} style={{ flex: 1 }} disabled={!perm?.granted} onPress={async () => { const p = await ref.current?.takePictureAsync({ quality: 0.85 }); if (p?.uri) { onShot({ uri: p.uri }); onClose(); } }} />
        </View>
      </View>
    </Modal>
  );
}

function ImageUploader({ svg, alt, label, shot, onChange }: { svg: string; alt: string; label: string; shot: Shot | null; onChange: (s: Shot | null) => void }) {
  const { t } = useTranslation();
  const [cam, setCam] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      {!shot ? (
        <View style={{ width: '100%', maxWidth: 260, maxHeight: 160, aspectRatio: 85 / 54, alignSelf: 'center', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', opacity: 0.6 }} accessibilityLabel={alt}>
          <SvgUri uri={`${SITE}${svg}`} width="100%" height="100%" />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        </View>
      ) : <Image source={{ uri: shot.uri }} style={{ width: '100%', height: 220, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} resizeMode="cover" accessibilityLabel={t('kycf.preview')} />}
      {shot ? <Done label={t('kycf.photoUploaded')} onRetake={() => onChange(null)} /> : <StdButton variant="ghost" label={label} full onPress={() => setCam(true)} />}
      <PhotoCamera visible={cam} onClose={() => setCam(false)} onShot={onChange} />
    </View>
  );
}

function LivenessRecorder({ video, onCapture, fullName }: { video: Shot | null; onCapture: (s: Shot | null) => void; fullName?: string }) {
  const { t } = useTranslation();
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
    // Kamera ya da mikrofon izni kalıcı reddedilmişse sistem penceresi açılamaz: neden gerektiği + "Ayarlara Git"
    if ((camPerm && !camPerm.granted && !camPerm.canAskAgain) || (micPerm && !micPerm.granted && !micPerm.canAskAgain)) {
      showSettingsAlert(PERM_REASON.kycCamera);
      setCamError(t('kycf.camMicDeniedApp')); setPhase('error'); return;
    }
    const cp = camPerm?.granted ? camPerm : await requestCam();
    const mp = micPerm?.granted ? micPerm : await requestMic();
    if (!cp.granted || !mp.granted) { setCamError(t('kycf.camMicDeniedApp')); setPhase('error'); return; }
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
        }).catch((e: Error) => { setCamError(t('kycf.camFailed', { error: e.message })); setPhase('error'); });
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
                  <T w={700} style={{ fontSize: 10, color: '#2ecc71' }}>{t('kycf.recording')}</T>
                </View>
                <T w={700} style={{ fontSize: 18, color: '#2ecc71', lineHeight: 18 }}>{recCountdown}</T>
              </View>
            )}
          </View>
          {phase === 'preview' && (
            <View style={{ padding: 16, gap: 12 }}>
              <T style={{ fontSize: 12, textAlign: 'center', color: '#2ecc71' }}>{currentLang() === 'en' ? <>{t('kycf.sayEn')} <T w={700} style={{ fontSize: 12, color: '#f5f5f5' }}>&quot;My name is {fullName}&quot;</T></> : t('kycf.sayTr')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <StdButton variant="ghost" label={t('kycf.cancel')} style={{ flex: 1 }} onPress={() => setPhase('idle')} />
                <StdButton variant="primary" label={t('kycf.startRec')} style={{ flex: 1 }} onPress={startRecording} />
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
      {video ? <Done label={t('kycf.videoUploaded')} onRetake={() => onCapture(null)} /> : (
        <>
          <Image source={require('@/assets/kyc-liveness-demo.webp')} style={{ width: '100%', height: 180, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }} resizeMode="cover" accessibilityLabel={t('kycf.videoAlt')} />
          <StdButton variant="ghost" label={t('kycf.uploadVideo')} full onPress={openCamera} />
          <View style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.3)' }}>
            <T style={{ fontSize: 12, color: 'rgba(192,57,43,0.85)', lineHeight: 19.2 }}>
              {t('kycf.privacy')}
            </T>
          </View>
        </>
      )}
    </View>
  );
}

async function uploadKyc(idType: IdType, front: Shot, back: Shot | null, video: Shot, onProgress: (p: number) => void) {
  const token = await getAccess();
  const form = new FormData();
  const ext = video.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
  form.append('idType', idType);
  form.append('idFront', { uri: front.uri, name: 'idFront.jpg', type: 'image/jpeg' } as unknown as Blob);
  // Pasaportta yalnız fotoğraflı sayfa (arka yüz yok)
  if (idType !== 'PASSPORT' && back) form.append('idBack', { uri: back.uri, name: 'idBack.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('liveness', { uri: video.uri, name: `liveness.${ext}`, type: ext === 'mov' ? 'video/quicktime' : 'video/mp4' } as unknown as Blob);
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_PREFIX}/kyc/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept-Language', currentLang());
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else { try { reject(new Error(JSON.parse(xhr.responseText)?.message ?? i18n.t('kycf.errorStatus', { status: xhr.status }))); } catch { reject(new Error(i18n.t('kycf.uploadFailedStatus', { status: xhr.status }))); } }
    };
    xhr.onerror = () => reject(new Error(i18n.t('kycf.networkError')));
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
  const { t } = useTranslation();
  const [idTypes, setIdTypes] = useState<IdType[]>(ID_TYPES);
  const [idType, setIdType] = useState<IdType>('ID_CARD');
  // Adım: önce belge türü, sonra çekim
  const [typeChosen, setTypeChosen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [front, setFront] = useState<Shot | null>(null);
  const [back, setBack] = useState<Shot | null>(null);
  const [video, setVideo] = useState<Shot | null>(null);

  // Bölgede izinli kimlik türleri (City.idTypes) ve canlılık videosu metni için ad soyad
  useEffect(() => {
    api.get<{ firstName?: string; lastName?: string; profile?: { primaryCity?: { idTypes?: IdType[] } } }>('/auth/me').then((u) => {
      setFullName(`${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim());
      const allowed = u?.profile?.primaryCity?.idTypes;
      const selectable = allowed?.filter((a) => ID_TYPES.includes(a));
      if (selectable?.length) { setIdTypes(selectable); if (!selectable.includes('ID_CARD')) setIdType(selectable[0]); }
    }).catch(() => undefined);
  }, []);
  const needsBack = idType !== 'PASSPORT';

  useEffect(() => {
    api.get<KycStatus>('/kyc/status').then((s) => { setStatus(s); if (s?.status === 'APPROVED') onApproved?.(); })
      .catch((e: Error) => {
        if (e.message.includes('404') || e.message.toLowerCase().includes('bulunamadı') || e.message.toLowerCase().includes('not found')) setStatus({ status: 'PENDING' });
        else if (e.message === '__rate_limit__') setError(t('common.rateLimit'));
        else setError(e.message);
      }).finally(() => setLoading(false));
  }, [onApproved]);

  async function submit() {
    if (!front || (needsBack && !back) || !video) { setError(t('kycf.fillAll')); return; }
    setSubmitting(true); setError('');
    try { await uploadKyc(idType, front, needsBack ? back : null, video, setProgress); setStatus({ status: 'PENDING' }); setFront(null); setBack(null); setVideo(null); setProgress(0); }
    catch (e) { setError((e as Error).message); } finally { setSubmitting(false); }
  }

  if (loading) return <SkeletonBlock lines={4} />;
  if (error && !status) return <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>;
  if (status?.status === 'APPROVED') {
    return (
      <Card style={{ alignItems: 'center', gap: 12 }}>
        <T style={{ fontSize: 30 }}>✓</T>
        <T w={500} style={{ fontSize: 16, color: tw4.green400 }}>{t('kycf.verified')}</T>
        <T style={{ fontSize: 13, color: ll.label, textAlign: 'center' }}>{t('kycf.verifiedInfo')}</T>
      </Card>
    );
  }
  if (status?.status === 'PENDING') {
    return (
      <Card style={{ alignItems: 'center', gap: 16, paddingTop: 0, paddingBottom: 32, paddingHorizontal: 0, overflow: 'hidden' }}>
        <KycBalls />
        <T w={600} style={{ fontSize: 16, paddingHorizontal: 24, textAlign: 'center' }}>{t('kycf.inReview')}</T>
        <T style={{ fontSize: 13, color: ll.label, paddingHorizontal: 24, textAlign: 'center' }}>{t('kycf.reviewing1')}{'\n'}{t('kycf.reviewing2')}</T>
      </Card>
    );
  }
  return (
    <View style={{ gap: 20 }}>
      {status?.status === 'REJECTED' && (
        <View style={{ backgroundColor: tw4.red900a20, borderWidth: 1, borderColor: tw4.red800, borderRadius: 16, padding: 16 }}>
          <T w={500} style={{ fontSize: 14, color: tw.accent, marginBottom: 4 }}>{t('kycf.rejected')}</T>
          <T style={{ fontSize: 13, color: ll.label }}>{status.rejectReason ?? t('kycf.reupload')}</T>
        </View>
      )}
      <Title>{t('kycf.title')}</Title>
      {/* 1. adım — belge türü (bölge ayarından); web TabKyc ile aynı */}
      {!typeChosen ? (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 13, color: '#c9c2b8' }}>{t('kycf.idType')}</T>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('kycf.idType')} style={{ gap: 8 }}>
            {idTypes.map((it) => (
              <Pressable key={it} accessibilityRole="radio" accessibilityState={{ checked: idType === it }} onPress={() => setIdType(it)}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: idType === it ? 'rgba(192,57,43,0.6)' : 'rgba(255,255,255,0.08)', backgroundColor: idType === it ? 'rgba(192,57,43,0.10)' : 'rgba(255,255,255,0.025)' }}>
                <T style={{ fontSize: 14, color: idType === it ? '#ff6b6b' : '#c9c2b8' }}>{t(`kycf.type${it}`)}</T>
              </Pressable>
            ))}
          </View>
          <StdButton variant="primary" label={t('common.continue')} full style={{ marginTop: 8 }} onPress={() => setTypeChosen(true)} />
        </View>
      ) : (
        <>
          {/* Seçilen belge türü; değiştirilirse çekilen fotoğraflar sıfırlanır */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <T style={{ fontSize: 13, color: '#c9c2b8' }}>{t('kycf.idType')}: <T w={600} style={{ fontSize: 13, color: ll.text }}>{t(`kycf.type${idType}`)}</T></T>
            <StdButton variant="ghost" label={t('prof.change')} onPress={() => { setTypeChosen(false); setFront(null); setBack(null); }} />
          </View>
          {/* 2. adım — önce ön yüz (pasaportta fotoğraflı sayfa), ön yüz çekilince arka yüz */}
          <ImageUploader svg="/kyc_demo_identity_card.svg" alt={t('kycf.frontAlt')} label={idType === 'PASSPORT' ? t('kycf.uploadPassport') : t('kycf.uploadFront')} shot={front} onChange={setFront} />
          {needsBack && !!front && <ImageUploader svg="/kyc_demo_identity_card_back.svg" alt={t('kycf.backAlt')} label={t('kycf.uploadBack')} shot={back} onChange={setBack} />}
          <LivenessRecorder video={video} onCapture={setVideo} fullName={fullName} />
        </>
      )}
      {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
      {typeChosen && <StdButton variant="primary" label={submitting ? t('kycf.uploading') : t('kycf.submit')} full disabled={submitting || !front || (needsBack && !back) || !video} style={(submitting || !front || (needsBack && !back) || !video) ? { opacity: 0.5 } : undefined} onPress={submit} />}
      {submitting && progress > 0 && (
        <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.10)' }}>
          <LinearGradient colors={['#1a5c2a', '#27ae60']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${progress}%` }} />
        </View>
      )}
    </View>
  );
}
