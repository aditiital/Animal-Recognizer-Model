/**
 * train-panel.js
 * Lets the user upload a dataset .zip (one folder per animal class) and
 * kicks off training on the backend, polling for progress until done.
 */

let selectedDatasetFile = null;
let trainPollInterval = null;

function wireTrainPanel() {
  const dropInput = document.getElementById('trainInput');
  const drop = document.getElementById('trainDrop');
  const startBtn = document.getElementById('startTrainBtn');
  const statusEl = document.getElementById('trainStatus');

  dropInput.addEventListener('change', () => {
    if (dropInput.files[0]) {
      selectedDatasetFile = dropInput.files[0];
      statusEl.textContent = `Selected: ${selectedDatasetFile.name}`;
    }
  });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    if (e.dataTransfer.files[0]) {
      selectedDatasetFile = e.dataTransfer.files[0];
      statusEl.textContent = `Selected: ${selectedDatasetFile.name}`;
    }
  });

  startBtn.addEventListener('click', startTraining);
}

async function startTraining() {
  const statusEl = document.getElementById('trainStatus');
  const startBtn = document.getElementById('startTrainBtn');
  const epochs = document.getElementById('epochsInput').value || 15;

  if (!selectedDatasetFile) {
    statusEl.innerHTML = '<div class="warn">Select a dataset .zip file first.</div>';
    return;
  }

  const formData = new FormData();
  formData.append('dataset', selectedDatasetFile);
  formData.append('epochs', epochs);

  startBtn.disabled = true;
  statusEl.innerHTML = '<span class="spinner"></span> Uploading dataset and starting training…';

  try {
    const resp = await fetch(`${BACKEND_URL}/train/start`, { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Server returned ${resp.status}`);

    statusEl.innerHTML = `<span class="spinner"></span> Training started on classes: ${data.classes_found.join(', ')}`;
    pollTrainingStatus();
  } catch (e) {
    const isNetworkError = e instanceof TypeError; // fetch throws TypeError on connection failure
    statusEl.innerHTML = isNetworkError
      ? `<div class="err">Could not reach the backend at ${BACKEND_URL}. Make sure <code>python app.py</code> is running in the backend folder.</div>`
      : `<div class="err">Failed to start training: ${e.message}</div>`;
    startBtn.disabled = false;
  }
}

function pollTrainingStatus() {
  const statusEl = document.getElementById('trainStatus');
  const progressFill = document.getElementById('trainProgressFill');
  const startBtn = document.getElementById('startTrainBtn');

  if (trainPollInterval) clearInterval(trainPollInterval);

  trainPollInterval = setInterval(async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/train/status`);
      const data = await resp.json();

      if (data.status === 'running') {
        const d = data.detail || {};
        if (d.stage === 'training') {
          const pct = d.total_epochs ? Math.round((d.epoch / d.total_epochs) * 100) : 0;
          progressFill.style.width = pct + '%';
          statusEl.innerHTML = `<span class="spinner"></span> [${d.phase}] epoch ${d.epoch}/${d.total_epochs} — acc ${d.accuracy ?? '-'}%, val_acc ${d.val_accuracy ?? '-'}%`;
        } else {
          statusEl.innerHTML = `<span class="spinner"></span> ${d.stage || 'working'}…`;
        }
      } else if (data.status === 'done') {
        progressFill.style.width = '100%';
        statusEl.innerHTML = '✅ Training complete! Reloading metrics…';
        clearInterval(trainPollInterval);
        startBtn.disabled = false;
        await loadMetricsDashboard();
        await checkBackendHealth();
      } else if (data.status === 'error') {
        statusEl.innerHTML = `<div class="err">Training failed: ${data.detail.message || 'unknown error'}</div>`;
        clearInterval(trainPollInterval);
        startBtn.disabled = false;
      }
    } catch (e) {
      statusEl.innerHTML = `<div class="err">Lost connection while polling training status: ${e.message}</div>`;
      clearInterval(trainPollInterval);
      startBtn.disabled = false;
    }
  }, 2000);
}