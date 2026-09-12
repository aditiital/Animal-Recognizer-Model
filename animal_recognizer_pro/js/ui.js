/**
 * ui.js
 * Tab switching, drag-and-drop wiring, and result rendering.
 * FIX: dropzones changed from <label> to <div> — click now manually triggers
 * the hidden file input, which fixes tab switching interference on some browsers.
 */

const ANIMAL_KEYWORDS = [
  'dog', 'cat', 'bird', 'horse', 'cow', 'sheep', 'pig', 'elephant', 'bear', 'zebra',
  'giraffe', 'lion', 'tiger', 'wolf', 'fox', 'rabbit', 'deer', 'monkey', 'ape', 'gorilla',
  'chimpanzee', 'snake', 'lizard', 'turtle', 'frog', 'fish', 'shark', 'whale', 'dolphin',
  'eagle', 'owl', 'parrot', 'hen', 'rooster', 'duck', 'goose', 'peacock', 'crab', 'lobster',
  'spider', 'butterfly', 'bee', 'ant', 'beetle', 'hamster', 'squirrel', 'otter', 'panda',
  'koala', 'kangaroo', 'camel', 'leopard', 'cheetah', 'hippopotamus', 'rhinoceros',
  'raccoon', 'skunk', 'hedgehog', 'porcupine', 'bat', 'crocodile', 'alligator', 'iguana',
  'chameleon', 'newt', 'salamander', 'jellyfish', 'octopus', 'squid', 'starfish',
  'seahorse', 'trout', 'salmon', 'goldfish', 'terrier', 'retriever', 'spaniel', 'poodle',
  'bulldog', 'shepherd', 'collie', 'hound', 'mastiff', 'tabby', 'siamese', 'persian cat',
  'egyptian cat',
];

const EMOJI_MAP = [
  [['dog', 'terrier', 'retriever', 'spaniel', 'poodle', 'bulldog', 'shepherd', 'collie', 'hound', 'mastiff'], '🐶'],
  [['cat', 'tabby', 'siamese', 'persian', 'egyptian'], '🐱'],
  [['bird', 'hen', 'rooster', 'duck', 'goose', 'peacock', 'parrot'], '🐦'],
  [['owl'], '🦉'],
  [['eagle'], '🦅'],
  [['horse'], '🐴'],
  [['cow'], '🐮'],
  [['sheep'], '🐑'],
  [['pig'], '🐷'],
  [['elephant'], '🐘'],
  [['bear', 'ice bear'], '🐻'],
  [['zebra'], '🦓'],
  [['giraffe'], '🦒'],
  [['lion'], '🦁'],
  [['tiger'], '🐯'],
  [['wolf'], '🐺'],
  [['fox'], '🦊'],
  [['rabbit'], '🐰'],
  [['deer'], '🦌'],
  [['monkey', 'ape', 'gorilla', 'chimpanzee'], '🐵'],
  [['snake'], '🐍'],
  [['lizard', 'iguana', 'chameleon'], '🦎'],
  [['turtle'], '🐢'],
  [['frog'], '🐸'],
  [['fish', 'trout', 'salmon', 'goldfish'], '🐟'],
  [['shark'], '🦈'],
  [['whale'], '🐳'],
  [['dolphin'], '🐬'],
  [['butterfly'], '🦋'],
  [['bee'], '🐝'],
  [['spider'], '🕷️'],
  [['panda'], '🐼'],
  [['koala'], '🐨'],
  [['kangaroo'], '🦘'],
  [['camel'], '🐫'],
  [['leopard', 'cheetah'], '🐆'],
  [['crocodile', 'alligator'], '🐊'],
  [['octopus', 'squid'], '🐙'],
  [['crab', 'lobster'], '🦀'],
  [['bat'], '🦇'],
  [['hedgehog', 'porcupine'], '🦔'],
];

function isAnimal(label) {
  const l = label.toLowerCase();
  return ANIMAL_KEYWORDS.some((k) => l.includes(k));
}

function emojiFor(label) {
  const l = label.toLowerCase();
  for (const [keys, emoji] of EMOJI_MAP) {
    if (keys.some((k) => l.includes(k))) return emoji;
  }
  return '🐾';
}

function wireTabs() {
  const tabs = [
    { tabId: 'tab-img',   panelId: 'panel-img' },
    { tabId: 'tab-vid',   panelId: 'panel-vid' },
    { tabId: 'tab-snd',   panelId: 'panel-snd' },
    { tabId: 'tab-train', panelId: 'panel-train' },
  ];

  tabs.forEach(({ tabId, panelId }) => {
    const tabEl = document.getElementById(tabId);
    if (!tabEl) {
      console.warn(`wireTabs: could not find #${tabId} — check index.html.`);
      return;
    }
    // Capture current iteration values explicitly to avoid any closure surprises
    const myTabId   = tabId;
    const myPanelId = panelId;

    tabEl.addEventListener('click', () => {
      tabs.forEach(({ tabId: t, panelId: p }) => {
        const tEl = document.getElementById(t);
        const pEl = document.getElementById(p);
        if (tEl) tEl.classList.toggle('active', t === myTabId);
        if (pEl) pEl.classList.toggle('active', p === myPanelId);
      });
    });
  });
}

/**
 * Wire a <div class="dropzone"> that contains a hidden <input type="file">.
 * Click on the div triggers the input. Drag-and-drop also supported.
 */
function wireDropzone(dropId, inputId, onFile) {
  const drop  = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  if (!drop || !input) {
    console.warn(`wireDropzone: missing #${dropId} or #${inputId}`);
    return;
  }

  // Click on the div -> open file picker
  drop.addEventListener('click', () => input.click());

  // File chosen via picker
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
  });

  // Drag-and-drop
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
}

/**
 * Renders a list of {label, <valueKey>} predictions as animated bars.
 */
function renderResults(container, items, valueKey) {
  let html = '';
  items.forEach((p, i) => {
    const pct      = (p[valueKey] * 100).toFixed(1);
    const barClass = i === 0 ? 'bar-fill' : 'bar-fill secondary';
    const emojiTag = i === 0 ? `<span class="top-emoji">${emojiFor(p.label)}</span>` : '';
    html += `
      <div class="result-row">
        <div class="result-top">
          <span>${emojiTag}<span style="font-weight:${i === 0 ? 700 : 400}">${p.label}</span></span>
          <span style="color:#666">${pct}%</span>
        </div>
        <div class="bar-bg"><div class="${barClass}" data-w="${pct}" style="width:0%"></div></div>
      </div>`;
  });
  container.innerHTML = html;
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach((el) => {
      el.style.width = el.dataset.w + '%';
    });
  });
}