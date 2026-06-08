const GA_MEASUREMENT_ID = 'G-2Q73WB1NLL';

export function initAnalytics() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.onload = () => {
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
  };
  document.head.appendChild(script);
}
