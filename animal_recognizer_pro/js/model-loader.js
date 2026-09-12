/**
 * model-loader.js
 * Shared utilities: loading external scripts with CDN fallback,
 * and racing any promise against a timeout so the UI never hangs forever.
 */

function loadScriptWithFallback(urls) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function tryNext() {
      if (i >= urls.length) {
        reject(new Error('All sources failed: ' + urls.join(', ')));
        return;
      }
      const script = document.createElement('script');
      script.src = urls[i];
      script.onload = () => resolve(urls[i]);
      script.onerror = () => { i++; tryNext(); };
      document.head.appendChild(script);
    }
    tryNext();
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms);
    }),
  ]);
}

const CDN_SOURCES = {
  tfjs: [
    'https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.20.0/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js',
    'https://unpkg.com/@tensorflow/tfjs@4.20.0/dist/tf.min.js',
  ],
  mobilenet: [
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',
    'https://unpkg.com/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',
  ],
};

async function ensureTfjsLoaded() {
  if (window.tf) return;
  await withTimeout(loadScriptWithFallback(CDN_SOURCES.tfjs), 20000, 'TensorFlow.js');
}

async function ensureMobilenetLoaded() {
  if (window.mobilenet) return;
  await withTimeout(loadScriptWithFallback(CDN_SOURCES.mobilenet), 20000, 'MobileNet script');
}

function networkErrorHelp(domainsHint) {
  return `This usually means a firewall/network is blocking ${domainsHint}. ` +
         `Try a different network, or ask your network admin to allowlist those domains.`;
}