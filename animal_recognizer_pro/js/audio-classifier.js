/**
 * audio-classifier.js
 * Loads YAMNet and classifies uploaded audio clips, filtered to animal-related sounds.
 */

let yamnetModel = null;
let yamnetClasses = [];

async function loadYamnet() {
  const statusEl = document.getElementById('sndStatus');
  try {
    await ensureTfjsLoaded();
    yamnetModel = await withTimeout(
      tf.loadGraphModel('https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1', { fromTFHub: true }),
      25000,
      'YAMNet weights'
    );

    const csvUrl =
      'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv';
    const resp = await withTimeout(fetch(csvUrl), 15000, 'YAMNet class list');
    const csv = await resp.text();
    yamnetClasses = csv
      .split('\n')
      .slice(1)
      .filter((row) => row.trim())
      .map((row) => {
        const parts = row.split(',');
        return parts[2] ? parts[2].replace(/"/g, '').trim() : '';
      });

    statusEl.innerHTML = '✅ Model ready. Upload an animal sound clip.';
  } catch (e) {
    statusEl.innerHTML =
      `<div class="err">Failed to load audio model: ${e.message}<br><br>` +
      networkErrorHelp('tfhub.dev, storage.googleapis.com, or raw.githubusercontent.com') +
      `</div>`;
  }
}

async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  return audioBuffer.getChannelData(0);
}

async function classifyAudio(file) {
  if (!yamnetModel) {
    throw new Error('Audio model is not loaded yet.');
  }
  const samples = await decodeAudioFile(file);
  const waveform = tf.tensor1d(samples);
  const result = yamnetModel.execute({ waveform });
  const scoresTensor = Array.isArray(result) ? result[0] : result;
  const scores = await scoresTensor.array();

  const meanScores = scores[0].map((_, colIdx) => {
    let sum = 0;
    for (let i = 0; i < scores.length; i++) sum += scores[i][colIdx];
    return sum / scores.length;
  });

  const indexed = meanScores.map((score, i) => ({
    label: yamnetClasses[i] || `class ${i}`,
    score,
  }));
  indexed.sort((a, b) => b.score - a.score);
  return indexed.slice(0, 5);
}