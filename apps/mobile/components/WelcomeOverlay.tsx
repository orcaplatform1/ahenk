// app/giris ve app/kayit "Hoş geldin" katmanı: pt-[18%] (genişliğin %18'i), top 30% merkezli 60vw ışıma (rgba(192,57,43,.12) → şeffaf %60),
// açılış ekranı AHENK yazılı logosu (ölçek 0,85 → 1, 0,1 sn gecikme, 0,4 sn), "Hoş geldin," (y 12 → 0, 0,4 sn gecikme), ad soyad (y 6 → 0, 0,55 sn gecikme, 0,35 sn)
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Modal, View } from 'react-native';
import { PageGlow, Serif } from './ui';

function Step({ delay, duration, dy = 0, scale = false, children, style }: { delay: number; duration: number; dy?: number; scale?: boolean; children: React.ReactNode; style?: object }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, delay, duration, easing: Easing.bezier(0, 0, 0.58, 1), useNativeDriver: true }).start(); }, [v, delay, duration]);
  const transform = scale ? [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }];
  return <Animated.View style={[style, { opacity: v, transform }]}>{children}</Animated.View>;
}

export function WelcomeOverlay({ visible, bg, name }: { visible: boolean; bg: string; name: string }) {
  return (
    <Modal visible={visible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', paddingTop: '18%' }}>
        <PageGlow top={0.3} left={0.5} w={0.6} h={0.6} center color="rgb(192,57,43)" opacity={0.12} stop={0.6} />
        {visible && (
          <>
            <Step delay={100} duration={400} scale style={{ alignItems: 'center', marginBottom: 56 }}>
              <Image source={require('@/assets/start_logo.jpg')} style={{ width: 120, height: 120, borderRadius: 60 }} />
            </Step>
            <Step delay={400} duration={400} dy={12} style={{ marginBottom: 4 }}><Serif style={{ fontSize: 36 }}>Hoş geldin,</Serif></Step>
            <Step delay={550} duration={350} dy={6}><Serif style={{ fontSize: 36, textAlign: 'center' }}>{name}</Serif></Step>
          </>
        )}
      </View>
    </Modal>
  );
}
