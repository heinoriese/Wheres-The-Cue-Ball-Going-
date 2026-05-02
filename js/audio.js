// John Virgo audio manager
// Drop MP3 clips into assets/audio/ named virgo_01.mp3, virgo_02.mp3, etc.

const Audio = (() => {
  const CLIP_COUNT_KEY = 'wtcbg_clip_count';
  let clips = [];
  let lastPlayed = -1;
  let muted = false;
  let clipCount = 0;

  // Called on first user interaction to probe how many clips exist
  async function probe() {
    // Try loading clips until we get a 404
    // Start from what we cached last session
    const cached = parseInt(sessionStorage.getItem(CLIP_COUNT_KEY) || '0');
    if (cached > 0) {
      clipCount = cached;
      buildClips();
      return;
    }
    for (let i = 1; i <= 99; i++) {
      const url = `assets/audio/virgo_${String(i).padStart(2, '0')}.mp3`;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) { clipCount = i - 1; break; }
        clipCount = i;
      } catch {
        clipCount = i - 1;
        break;
      }
    }
    sessionStorage.setItem(CLIP_COUNT_KEY, String(clipCount));
    buildClips();
  }

  function buildClips() {
    clips = [];
    for (let i = 1; i <= clipCount; i++) {
      const url = `assets/audio/virgo_${String(i).padStart(2, '0')}.mp3`;
      clips.push(new window.Audio(url));
    }
  }

  function playVirgo() {
    if (muted || clips.length === 0) return;
    // Pick random clip, avoid repeating last one
    let idx;
    do {
      idx = Math.floor(Math.random() * clips.length);
    } while (clips.length > 1 && idx === lastPlayed);
    lastPlayed = idx;

    const clip = clips[idx].cloneNode();
    clip.volume = 0.85;
    clip.play().catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  // Auto-probe once DOM is ready
  document.addEventListener('DOMContentLoaded', probe);

  return { playVirgo, toggleMute, probe };
})();
