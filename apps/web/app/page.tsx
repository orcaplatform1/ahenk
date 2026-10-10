'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';

const steps = [
  {
    n: '01',
    title: 'Profilini oluştur',
    desc: 'Birkaç dakikada hesabını aç, şehrini seç.',
  },
  {
    n: '02',
    title: 'Kişilik testini tamamla',
    desc: 'OCEAN modeline dayalı 19 soruluk bilimsel test.',
  },
  {
    n: '03',
    title: 'Algoritma eşleştirir',
    desc: 'Her Perşembe algoritma seni en uyumlu kişilerle bir araya getirir.',
  },
  {
    n: '04',
    title: 'Cumartesi buluşursun',
    desc: 'Şehrindeki mekan belirlenir, bildirimi alırsın.',
  },
];

const cities = [
  'İstanbul',
  'Ankara',
  'İzmir',
  'Antalya',
  'Muğla',
  'Aydın',
  'Balıkesir',
  'Konya',
];

const plans = [
  {
    name: 'Masada',
    price: '349',
    desc: 'Aylık grup buluşma hakkı',
    featured: false,
  },
  {
    name: 'Karşımda',
    price: '449',
    desc: 'Tek kullanımlık başbaşa buluşma',
    featured: false,
  },
  {
    name: 'İçerde',
    price: '679',
    desc: '1 ay Masada + 1 Karşımda hakkı',
    featured: true,
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: 'Kim kimle eşleşiyor?',
    a: 'OCEAN kişilik testine göre uyumlu, aynı şehirde buluşmak isteyen kişiler.',
  },
  {
    q: 'Güvenlik nasıl sağlanıyor?',
    a: 'Tüm kullanıcılar kimlik doğrulamasından geçer.',
  },
  {
    q: 'Ödeme iadesi var mı?',
    a: 'Buluşma gerçekleşmezse tam iade yapılır.',
  },
  {
    q: 'Buluşmaya gidemezsem ne olur?',
    a: 'En az 24 saat önceden bildirmen gerekir.',
  },
  {
    q: 'Kişilik testi nedir?',
    a: 'OCEAN (Big Five) modeline dayalı 19 soruluk bilimsel test.',
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-bg text-text">
      <Navbar />

      {/* Hero */}
      <section id="hero" className="max-w-5xl mx-auto px-4 pt-24 pb-20 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-tight mb-6">
          Yabancılarla Dolu Bir Masa
          <br />
          Seni Bekliyor
        </h1>
        <p className="text-muted text-lg sm:text-xl max-w-xl mx-auto mb-10">
          Her hafta algoritma seni uyumlu 5 kişiyle eşleştirir. Cumartesi akşamı buluşursunuz.
        </p>
        <a
          href="#cities"
          className="inline-block px-8 py-4 bg-primary hover:bg-primary-hover transition-colors rounded-xl text-base font-medium"
        >
          Şehrini Seç →
        </a>
      </section>

      {/* Nasıl Çalışır */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="font-serif text-3xl sm:text-4xl text-center mb-12">
          Nasıl Çalışır?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div
              key={s.n}
              className="bg-surface border border-border rounded-2xl p-6"
            >
              <span className="font-serif text-5xl text-primary leading-none block mb-4">
                {s.n}
              </span>
              <h3 className="font-medium text-lg mb-2">{s.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Şehirler */}
      <section id="cities" className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="font-serif text-3xl sm:text-4xl text-center mb-4">
          Aktif Olduğumuz Şehirler
        </h2>
        <p className="text-muted text-center mb-10">
          Aşağıdaki şehirlerde her hafta masalar kuruluyor.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {cities.map((city) => (
            <span
              key={city}
              className="px-5 py-2 rounded-full border border-border bg-surface text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-default"
            >
              {city}
            </span>
          ))}
        </div>
      </section>

      {/* Paketler */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="font-serif text-3xl sm:text-4xl text-center mb-12">
          Paketler
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-surface rounded-2xl p-8 flex flex-col gap-4 border ${
                plan.featured ? 'border-primary' : 'border-border'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-xs font-semibold rounded-full whitespace-nowrap">
                  Tercih Edilen
                </span>
              )}
              <h3 className="font-serif text-2xl">{plan.name}</h3>
              <div className="text-4xl font-bold">
                {plan.price}
                <span className="text-xl font-normal text-muted">₺</span>
              </div>
              <p className="text-muted text-sm flex-1">{plan.desc}</p>
              <button
                className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                  plan.featured
                    ? 'bg-primary hover:bg-primary-hover'
                    : 'border border-border hover:border-muted'
                }`}
              >
                Paketi Seç
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SSS */}
      <section id="faq" className="max-w-2xl mx-auto px-4 py-20">
        <h2 className="font-serif text-3xl sm:text-4xl text-center mb-12">
          Sık Sorulan Sorular
        </h2>
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-2xl overflow-hidden"
            >
              <button
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-medium text-sm sm:text-base">{faq.q}</span>
                <span
                  className={`text-muted text-xl transition-transform flex-shrink-0 ${
                    openFaq === i ? 'rotate-45' : ''
                  }`}
                >
                  +
                </span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-muted text-sm leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-muted text-sm">
          <span>Ahenk © 2026</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-text transition-colors">
              Gizlilik Politikası
            </a>
            <a href="#" className="hover:text-text transition-colors">
              Kullanım Koşulları
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
