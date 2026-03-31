// On Call — Native Bridge (Capacitor 8)
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';

const isNative = Capacitor.isNativePlatform();

export const Native = {
  isNative,
  
  async init() {
    if (!isNative) return;
    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#f8f9fc' });
      await SplashScreen.hide();
    } catch (e) { console.warn('Native init:', e); }
  },

  async haptic(style = 'light') {
    if (!isNative) return;
    try {
      const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
      await Haptics.impact({ style: map[style] || ImpactStyle.Light });
    } catch (e) {}
  },

  async openUrl(url) {
    if (isNative) {
      await Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  },

  async share(data) {
    if (isNative) {
      await Share.share(data);
    } else if (navigator.share) {
      await navigator.share(data);
    }
  },
};

// Auto-init on import
Native.init();
