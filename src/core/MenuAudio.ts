const menuAudio = new Audio(
  new URL("../../assets/Sound/backsound-menu.mp3", import.meta.url).href,
);
menuAudio.loop = true;
menuAudio.volume = 0.5;

export function playMenuAudio(): void {
  void menuAudio.play().catch(() => {
    // Browser memblokir autoplay — tunggu klik pertama pemain.
    document.addEventListener(
      "click",
      () => {
        void menuAudio.play().catch(() => undefined);
      },
      { once: true },
    );
  });
}

export function stopMenuAudio(): void {
  menuAudio.pause();
  menuAudio.currentTime = 0;
}
