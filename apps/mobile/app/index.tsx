// Açılış ekranı (S-22): 3 sn, siyah zemin, logo dikey ekseninde dönerek; altında Traders.TR markası (web SiteFooter stili)
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAccess, getKind } from '@/lib/session';
import { useReduceMotion } from '@/lib/motion';
import { c, sans, tw } from '@/theme/theme';

const SPLASH_MS = 3000;

export default function Acilis() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, spin]);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      const kind = await getKind();
      const token = await getAccess();
      const wait = Math.max(0, SPLASH_MS - (Date.now() - started));
      setTimeout(() => {
        if (!alive) return;
        if (kind === 'venue') router.replace('/mekan/bilgiler');
        else if (token) router.replace('/(tabs)');
        else router.replace('/giris');
      }, wait);
    })();
    return () => { alive = false; };
  }, [router]);

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ flex: 1, backgroundColor: c.black, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }] }}>
        <Image source={require('@/assets/start_logo.jpg')} style={{ width: 160, height: 160, borderRadius: 80 }} />
      </Animated.View>
      <Text style={{ marginTop: 28, color: tw.text, fontSize: 12.5, lineHeight: 19, fontFamily: sans(400), textAlign: 'center' }}>
        Ahenk bir{' '}
        <Text style={{ color: c.tradersText, fontFamily: sans(700) }}>Traders</Text>
        <Text style={{ color: c.tradersTR, fontFamily: sans(800) }}>.TR</Text>
        <Text> 🇹🇷</Text>
        {' '}ticari markasıdır.
      </Text>
    </View>
  );
}
