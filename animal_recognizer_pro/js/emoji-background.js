/**
 * emoji-background.js
 * Spawns floating, swaying animal emojis in the page background.
 * Pure DOM/CSS animation — no external dependencies, cannot fail from network issues.
 */

const EMOJIS = ['🐶', '🐱', '🦁', '🐼', '🦊', '🐰', '🐨', '🐯', '🐵', '🦉', '🐢', '🐬', '🦋', '🐘', '🦒'];

function spawnEmoji() {
  const bg = document.getElementById('emoji-bg');
  if (!bg) return;

  const el = document.createElement('div');
  el.className = 'float-emoji';
  el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

  const left = Math.random() * 95;
  const floatDuration = 14 + Math.random() * 10;
  const swayDuration = 3 + Math.random() * 2;
  const size = 22 + Math.random() * 24;

  el.style.left = left + '%';
  el.style.fontSize = size + 'px';
  el.style.animationDuration = floatDuration + 's, ' + swayDuration + 's';

  bg.appendChild(el);
  setTimeout(() => el.remove(), floatDuration * 1000 + 200);
}

function startEmojiBackground() {
  for (let i = 0; i < 8; i++) {
    setTimeout(spawnEmoji, i * 900);
  }
  setInterval(spawnEmoji, 1600);
}

startEmojiBackground();