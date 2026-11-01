// OCEAN metinlerinin tek kaynağı: sonuç aurası, profil sekmesi ve radar grafikleri buradan okur
export type OceanKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

export const OCEAN_DIMENSIONS: {
  key: OceanKey;
  label: string;
  sub: string;
  levels: readonly string[];
  axis: { label: string; desc: string };
  trait: { label: string; radarLabel: string; desc: string };
}[] = [
  {
    key: 'openness',
    label: 'Açıklık',
    sub: 'Yaratıcılık & Deneyim',
    levels: [
      'Yeni fikir ve deneyimlere karşı temkinlisin. Tanıdık ortamlar seni rahatlatıyor, belirsizlik ise zorlayabiliyor. Masalarda güvenli konularda güçlüsün.',
      'Merakın var ama seçici davranıyorsun. Bazı konularda derinleşmeyi seviyorsun, ancak her fikre kapı aralamıyorsun. Masalarda dengeli bir katkı sunuyorsun.',
      'Fikir ve deneyimlere tamamen açıksın. Masalarda entelektüel derinliği, sanatı ve sıra dışı bakış açılarını tetikleyen ana jeneratör sensin.',
    ],
    axis: { label: 'Açıklık', desc: 'Yeni deneyimlere ve fikirlere açıklık' },
    trait: { label: 'Açıklık', radarLabel: 'Açıklık', desc: 'Yeni deneyimlere, fikirlere ve yaratıcılığa açıklık' },
  },
  {
    key: 'conscientiousness',
    label: 'Özdisiplin',
    sub: 'Hedef & Düzen',
    levels: [
      'Anlık kararlarla hareket etmeyi seviyorsun. Planlama yerine spontanlık seni tanımlıyor. Masalarda sürpriz enerji getiriyorsun ama tutarlılık zor olabiliyor.',
      'Belirli alanlarda düzenlisin, ancak esnekliğini de koruyorsun. Masalarda gerektiğinde organize olabilen, gerektiğinde akışa bırakabilen birisin.',
      'Hedef odaklı ve tutarlısın. Grup dinamiklerinde güven veren, masanın dengesini ve akışını koruyan sessiz organizatör sensin.',
    ],
    axis: { label: 'Öz-Disiplin', desc: 'Düzen, sorumluluk ve hedef odaklılık' },
    trait: { label: 'Özdisiplin', radarLabel: 'Özdisiplin', desc: 'Düzen, planlama ve hedef odaklılık' },
  },
  {
    key: 'extraversion',
    label: 'Dışadönüklük',
    sub: 'Sosyal Enerji',
    levels: [
      'Sosyal ortamlar seni yoruyor, yalnız zaman enerji veriyor. Masalarda derin bire bir bağlantılarda parıldassan da kalabalık dinamikler zorlayabiliyor.',
      'Ne tam içedönük ne tam dışadönüksün, ortam ve insanlara göre değişiyorsun. Masalarda seçici ama kaliteli bir enerji yayıyorsun.',
      'Sosyal ortamlardan enerji alıyorsun. Masaya oturduğun andan itibaren buzları eriten, konuşmaları başlatan ve ortamı ısıtan birisin.',
    ],
    axis: { label: 'Dışadönüklük', desc: 'Sosyal enerji ve çevresiyle etkileşim' },
    trait: { label: 'Dışadönüklük', radarLabel: 'Dışadönüklük', desc: 'Sosyal enerji, girişkenlik ve sohbet isteği' },
  },
  {
    key: 'agreeableness',
    label: 'Uyumluluk',
    sub: 'Empati & İşbirliği',
    levels: [
      'Kendi bakış açın güçlü ve bunu kolayca bırakmıyorsun. Masalarda tartışmayı canlandırıyorsun ancak ortak zemin bulmak zaman alıyor.',
      'İşbirliğine açıksın ama sınırların da var. Masalarda hem kendi sesini duyurabiliyorsun hem de diğerlerini dinleyebiliyorsun.',
      'Empatik frekansın çok yüksek. İnsanları dinleme ve ortak paydada buluşturma yeteneğinle dahil olduğun her masada derin bir konfor alanı yaratıyorsun.',
    ],
    axis: { label: 'Uyumluluk', desc: 'Empati, işbirliği ve güven' },
    trait: { label: 'Uyumluluk', radarLabel: 'Uyumluluk', desc: 'Empati, iş birliği ve güvenilirlik' },
  },
  {
    key: 'neuroticism',
    label: 'Denge',
    sub: 'Duygusal Esneklik',
    levels: [
      'Duygular seni güçlü etkiliyor ve bunu çevrene yansıtıyorsun. Masalarda yoğun anlarda dengeyi korumak zorlaşabiliyor, ama bu aynı zamanda özgünlüğünün bir parçası.',
      'Duygusal esnekliğin gelişiyor. Çoğu durumda sakin kalabiliyorsun, ancak beklenmedik anlarda zaman zaman sendeleyebiliyorsun.',
      'Duygusal zemin sağlam. Hararetli tartışmalarda bile sakin kalabiliyor, masadaki en dengeli ve rasyonel frekansı sen yayıyorsun.',
    ],
    axis: { label: 'Nevrotiklik', desc: 'Duygusal dalgalanma ve stres tepkisi' },
    trait: { label: 'Duygusal Denge', radarLabel: 'Denge', desc: 'Duygusal istikrar ve stres toleransı' },
  },
];

// OceanRadar eksen ve hover metinleri
export const OCEAN_RADAR_AXES = OCEAN_DIMENSIONS.map(({ key, axis }) => ({ key, ...axis }));

// Test sonuç sayfası radar ve özellik metinleri
export const OCEAN_TRAITS = OCEAN_DIMENSIONS.map(({ key, trait }) => ({ key, ...trait }));
