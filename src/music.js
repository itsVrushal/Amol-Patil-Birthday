/**
 * music.js — Background music player
 * Reads track list from config.json, loops on end, shows progress bar.
 */

let audio    = null;
let isMuted  = true;
let config   = null;

export function initMusic(cfg) {
  config   = cfg;
  audio    = document.getElementById('bgMusic');
  if (!audio) return;

  const musicCfg = config.music;
  if (!musicCfg || !musicCfg.enabled) return;

  // Set default track
  const defaultTrack = musicCfg.tracks.find(t => t.id === musicCfg.defaultTrack)
    || musicCfg.tracks[0];

  // Default mute state from config (defaults to unmuted if defaultMuted is false)
  isMuted = musicCfg.defaultMuted === true;
  audio.muted  = isMuted;
  audio.volume = isMuted ? 0 : 0.6;

  if (defaultTrack) loadTrack(defaultTrack);

  // Loop on end
  audio.addEventListener('ended', () => {
    if (musicCfg.loop && !isMuted) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  });

  // Progress bar
  audio.addEventListener('timeupdate', updateProgress);

  updateMutedUI();
}

export function setupMusicToggle() {
  const btn = document.getElementById('musicToggle');
  if (!btn) return;

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    toggleMute();
  };

  btn.addEventListener('click', handleToggle);
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
}

function toggleMute() {
  isMuted = !isMuted;

  if (isMuted) {
    audio.muted = true;
    audio.volume = 0;
    audio.pause();
  } else {
    audio.muted = false;
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }

  updateMutedUI();
}

function updateMutedUI() {
  const player = document.getElementById('musicPlayer');
  if (!player) return;
  if (isMuted) player.classList.add('muted');
  else         player.classList.remove('muted');
}

function loadTrack(track) {
  const trackName = document.getElementById('trackName');
  if (trackName) trackName.textContent = track.title;
  audio.src = track.file;
  audio.load();
  if (!isMuted) {
    audio.play().catch(() => {
      // Browser autoplay policy might hold sound until first gesture.
      // isMuted stays false so it will start playing on the very first gesture!
    });
  }
}

function updateProgress() {
  if (!audio.duration) return;
  const pct = audio.currentTime / audio.duration;
  const bar = document.getElementById('trackBar');
  if (bar) bar.style.transform = `scaleX(${pct})`;
}

// Called externally if config changes track
export function setTrack(trackId) {
  const track = config.music.tracks.find(t => t.id === trackId);
  if (track) loadTrack(track);
}

export function tryPlay() {
  // STRICT GUARD: If user has muted music, NEVER auto-play or unmute!
  if (isMuted) return;
  if (audio && audio.paused) {
    audio.muted = false;
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }
}
