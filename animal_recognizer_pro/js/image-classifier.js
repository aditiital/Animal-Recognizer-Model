/**
 * image-classifier.js
 * Sends the uploaded image to the Python Flask backend for classification.
 * Backend automatically uses a custom-trained model if one exists, otherwise
 * falls back to MobileNetV2+ImageNet so ANY animal can still be recognized.
 *
 * FIX: Added low-confidence caution note for white big cats misidentified as
 *      Arctic Fox / white wolf etc. (MobileNetV2 has no "white lion cub" class).
 */

const BACKEND_URL = 'http://localhost:5000';

// These ImageNet labels commonly get confused for white big cat cubs
const WHITE_FLUFFY_CONFUSERS = [
  'arctic fox', 'white wolf', 'staffordshire bullterrier', 'west highland white terrier',
  'samoyed', 'maltese dog', 'bichon frise', 'ice bear', 'great pyrenees',
];

async function checkBackendHealth() {
  const statusEl = document.getElementById('imgStatus');
  try {
    const resp = await withTimeout(fetch(`${BACKEND_URL}/health`), 5000, 'Backend health check');
    const data = await resp.json();
    if (data.mode === 'custom') {
      statusEl.innerHTML = `✅ Using your custom-trained model (${data.classes.join(', ')}).`;
    } else {
      statusEl.innerHTML = '✅ No custom model yet — using general pretrained model (recognizes any common animal). Upload photos in the Train tab to specialize it.';
    }
    return true;
  } catch (e) {
    statusEl.innerHTML =
      `<div class="err">Could not reach the backend at ${BACKEND_URL}. ` +
      `Make sure it's running: <code>cd backend && python app.py</code></div>`;
    return false;
  }
}

async function classifyImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await withTimeout(
    fetch(`${BACKEND_URL}/predict/image`, { method: 'POST', body: formData }),
    30000,
    'Prediction request'
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Server returned ${resp.status}`);
  }

  const data = await resp.json();
  return {
    predictions: data.predictions.map((p) => ({ label: p.label, prob: p.confidence / 100 })),
    mode: data.mode,
  };
}

/**
 * Returns a caution HTML string if the top prediction is a commonly-confused
 * white fluffy animal with low confidence — likely a white big cat cub.
 */
function getCautionNote(predictions) {
  if (!predictions || predictions.length === 0) return '';
  const top = predictions[0];
  const topLabel = top.label.toLowerCase();
  const isConfuser = WHITE_FLUFFY_CONFUSERS.some((k) => topLabel.includes(k));
  if (isConfuser && top.prob < 0.5) {
    return `<div class="caution-note">⚠️ Low confidence (${(top.prob * 100).toFixed(1)}%) — the animal may be a <strong>white lion, tiger, or leopard cub</strong>. The general pretrained model wasn't trained on rare white coat variants. Go to the <strong>Train</strong> tab and upload a custom dataset for accurate results.</div>`;
  }
  return '';
}

async function fetchTrainingMetrics() {
  const resp = await fetch(`${BACKEND_URL}/metrics`);
  if (!resp.ok) throw new Error('No custom metrics yet — currently using the general pretrained fallback model.');
  return resp.json();
}