const sfxBenar = new Audio(new URL("../../assets/Sound/kuis-benar.mp3", import.meta.url).href);
const sfxSalah = new Audio(new URL("../../assets/Sound/kuis-salah.mp3", import.meta.url).href);
const sfxKlik = new Audio(new URL("../../assets/Sound/klik.mp3", import.meta.url).href);

sfxBenar.volume = 0.6;
sfxSalah.volume = 0.6;
sfxKlik.volume = 0.7;

export function playBenar(): void {
  sfxBenar.currentTime = 0;
  void sfxBenar.play().catch(() => undefined);
}

export function playSalah(): void {
  sfxSalah.currentTime = 0;
  void sfxSalah.play().catch(() => undefined);
}

export function playKlik(): void {
  sfxKlik.currentTime = 0;
  void sfxKlik.play().catch(() => undefined);
}

// Sistem SFX klik global (event delegation)
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest("button")) {
    return;
  }
  playKlik();
});
