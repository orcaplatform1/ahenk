// Android: kayıtlı şifre otomatik doldurulunca alanlara sistemin çizdiği sarı vurguyu kaldırır
// (AppTheme'e android:autofilledHighlight = şeffaf); alanlar normal arka planında kalır.
const { withAndroidStyles } = require('expo/config-plugins');

module.exports = function withAutofillHighlight(config) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style ?? [];
    const app = styles.find((s) => s.$.name === 'AppTheme');
    if (app) {
      app.item = (app.item ?? []).filter((i) => i.$.name !== 'android:autofilledHighlight');
      app.item.push({ $: { name: 'android:autofilledHighlight' }, _: '@android:color/transparent' });
    }
    return cfg;
  });
};
