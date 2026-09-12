/**
 * main.js
 * Application entry point: wires up tabs, dropzones, and connects to the
 * Python backend for image/video classification. Audio still runs
 * in-browser via YAMNet. Training panel lets the user upload a dataset.
 *
 * FIX: getCautionNote() injected before results so white big cat mismatches
 *      are flagged to the user immediately.
 */

document.addEventListener('DOMContentLoaded', () => {
  wireTabs();
  wireTrainPanel();

  checkBackendHealth();
  loadYamnet();
  loadMetricsDashboard();

  // --- Image upload flow ---
  wireDropzone('imgDrop', 'imgInput', async (file) => {
    const img        = document.getElementById('preview');
    const statusDiv  = document.getElementById('imgStatus');
    const resultsDiv = document.getElementById('imgResults');

    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
    resultsDiv.innerHTML = '';
    statusDiv.innerHTML = '<span class="spinner"></span> Sending image to backend…';

    try {
      const { predictions, mode } = await classifyImage(file);
      statusDiv.innerHTML = mode === 'custom'
        ? '✅ Done (custom model).'
        : '✅ Done (general pretrained model).';

      const animalPreds = predictions.filter((p) => isAnimal(p.label));
      const toShow = animalPreds.length > 0 ? animalPreds : predictions;

      // Inject caution note for likely white big cat mismatches
      const caution = getCautionNote(toShow);

      if (animalPreds.length === 0) {
        resultsDiv.innerHTML =
          caution +
          '<div class="warn">No confident animal match found — showing top general predictions instead.</div>';
      } else {
        resultsDiv.innerHTML = caution;
      }

      renderResults(resultsDiv, toShow, 'prob');
    } catch (err) {
      statusDiv.innerHTML = `<div class="err">Error analyzing image: ${err.message}</div>`;
    }
  });

  // --- Video upload flow ---
  wireDropzone('vidDrop', 'vidInput', async (file) => {
    const video      = document.getElementById('videoPreview');
    const statusDiv  = document.getElementById('vidStatus');
    const resultsDiv = document.getElementById('vidResults');

    video.src = URL.createObjectURL(file);
    video.style.display = 'block';
    resultsDiv.innerHTML = '';
    statusDiv.innerHTML = '<span class="spinner"></span> Extracting a frame and analyzing…';

    try {
      const { predictions, mode } = await classifyVideoFrame(video);
      statusDiv.innerHTML = mode === 'custom'
        ? '✅ Done (custom model).'
        : '✅ Done (general pretrained model).';

      const animalPreds = predictions.filter((p) => isAnimal(p.label));
      const toShow = animalPreds.length > 0 ? animalPreds : predictions;
      const caution = getCautionNote(toShow);

      if (animalPreds.length === 0) {
        resultsDiv.innerHTML =
          caution +
          '<div class="warn">No confident animal match found in the sampled frame.</div>';
      } else {
        resultsDiv.innerHTML = caution;
      }

      renderResults(resultsDiv, toShow, 'prob');
    } catch (err) {
      statusDiv.innerHTML = `<div class="err">Error analyzing video: ${err.message}</div>`;
    }
  });

  // --- Sound upload flow ---
  wireDropzone('sndDrop', 'sndInput', async (file) => {
    const audioEl    = document.getElementById('audioPreview');
    const statusDiv  = document.getElementById('sndStatus');
    const resultsDiv = document.getElementById('sndResults');

    audioEl.src = URL.createObjectURL(file);
    audioEl.style.display = 'block';
    resultsDiv.innerHTML = '';

    if (!yamnetModel) {
      statusDiv.innerHTML = 'Model still loading, please wait…';
      return;
    }

    statusDiv.innerHTML = '<span class="spinner"></span> Analyzing sound…';

    try {
      const top = await classifyAudio(file);
      statusDiv.innerHTML = '✅ Done.';

      const animalTop = top.filter((p) => isAnimal(p.label));
      const toShow = animalTop.length > 0 ? animalTop : top;

      if (animalTop.length === 0) {
        resultsDiv.innerHTML =
          '<div class="warn">No confident animal sound match — showing top general predictions instead.</div>';
      }

      renderResults(resultsDiv, toShow, 'score');
    } catch (err) {
      statusDiv.innerHTML = `<div class="err">Error analyzing sound: ${err.message}</div>`;
    }
  });
});

async function loadMetricsDashboard() {
  const statusEl = document.getElementById('metricsStatus');
  try {
    const report = await fetchTrainingMetrics();
    const m = report.metrics;
    document.getElementById('m-accuracy').textContent  = m.accuracy  + '%';
    document.getElementById('m-precision').textContent = m.precision + '%';
    document.getElementById('m-recall').textContent    = m.recall    + '%';
    document.getElementById('m-f1').textContent        = m.f1_score  + '%';
    if (statusEl) statusEl.textContent = '';
  } catch (e) {
    document.getElementById('m-accuracy').textContent  = '—';
    document.getElementById('m-precision').textContent = '—';
    document.getElementById('m-recall').textContent    = '—';
    document.getElementById('m-f1').textContent        = '—';
    if (statusEl) statusEl.innerHTML = `<span style="color:#999">${e.message}</span>`;
  }
}