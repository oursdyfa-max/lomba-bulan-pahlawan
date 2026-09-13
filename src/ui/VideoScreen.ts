export class VideoScreen {
  private readonly overlay: HTMLDivElement;
  private readonly video: HTMLVideoElement;
  private readonly skipButton: HTMLButtonElement;
  private isFinished = false;
  private isResetting = false;
  private onComplete: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    this.overlay = document.createElement("div");
    this.overlay.className = "video-screen";
    this.overlay.setAttribute("aria-label", "Video pembuka misi");
    this.overlay.hidden = true;

    this.video = document.createElement("video");
    this.video.className = "video-screen__player";
    this.video.src = new URL("../../assets/Level1/portal-lvl1.mp4", import.meta.url).href;
    this.video.preload = "auto";
    this.video.playsInline = true;
    this.video.controls = false;
    this.video.disablePictureInPicture = true;
    this.video.addEventListener("ended", this.handleEnded);
    this.video.addEventListener("pause", this.handlePause);
    this.video.addEventListener("seeking", this.handleSeeking);
    this.video.addEventListener("contextmenu", this.handleContextMenu);
    this.skipButton = document.createElement("button");
    this.skipButton.className = "video-screen__skip";
    this.skipButton.type = "button";
    this.skipButton.textContent = "Lewati Video";
    this.skipButton.addEventListener("click", this.handleSkip);
    this.overlay.appendChild(this.video);
    this.overlay.appendChild(this.skipButton);
    this.root.appendChild(this.overlay);
    this.video.load();
  }

  play(onComplete: () => void): void {
    this.isFinished = false;
    this.onComplete = onComplete;
    this.video.onended = null;
    this.overlay.hidden = false;
    if (this.video.readyState > HTMLMediaElement.HAVE_NOTHING) {
      this.isResetting = true;
      this.video.currentTime = 0;
    }
    void this.video.play().catch(() => undefined);
  }

  private readonly handleEnded = (): void => {
    this.finish();
  };

  private readonly handleSkip = (): void => {
    this.finish();
  };

  private finish(): void {
    if (this.isFinished) {
      return;
    }

    this.isFinished = true;
    this.video.pause();
    this.video.removeEventListener("ended", this.handleEnded);
    this.video.removeEventListener("pause", this.handlePause);
    this.video.removeEventListener("seeking", this.handleSeeking);
    this.video.removeEventListener("contextmenu", this.handleContextMenu);
    this.skipButton.removeEventListener("click", this.handleSkip);
    this.video.removeAttribute("src");
    this.video.load();
    this.overlay.remove();
    const onComplete = this.onComplete;
    this.onComplete = null;
    onComplete?.();
  };

  private readonly handlePause = (): void => {
    if (!this.isFinished && !this.video.ended && this.video.currentTime < this.video.duration - 0.05) {
      void this.video.play().catch(() => undefined);
    }
  };

  private readonly handleSeeking = (): void => {
    if (this.isResetting) {
      this.isResetting = false;
      return;
    }

    if (!this.isFinished) {
      this.video.currentTime = 0;
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}