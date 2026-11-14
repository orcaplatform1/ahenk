// Android APK derleme ayarları (gradle.properties): release derlemede R8 kod küçültme ve kullanılmayan kaynakların atılması açık,
// yalnız arm64-v8a mimarisi, Hermes açık. (Expo şablonunun android/app/build.gradle dosyası bu anahtarları okur.)
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
  reactNativeArchitectures: 'arm64-v8a',
  hermesEnabled: 'true',
};

module.exports = function withAndroidRelease(config) {
  return withGradleProperties(config, (cfg) => {
    const items = cfg.modResults.filter((i) => !(i.type === 'property' && i.key in PROPS));
    for (const [key, value] of Object.entries(PROPS)) items.push({ type: 'property', key, value });
    cfg.modResults = items;
    return cfg;
  });
};
