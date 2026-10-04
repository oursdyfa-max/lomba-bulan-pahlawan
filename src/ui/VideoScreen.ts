export class VideoScreen {
  private overlay: HTMLDivElement | null = null;
  private video: HTMLVideoElement | null = null;
  private skipButton: HTMLButtonElement | null = null;
  private isFinished = false;
  private isResetting = false;
  private onComplete: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {}

  private play(source: string, onComplete: () => void): void {
    this.finish(false);
    this.isFinished = false;
    this.isResetting = false;
    this.onComplete = onComplete;
    this.overlay = document.createElement("div");
    this.overlay.className = "video-screen";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-label", "Video portal level berikutnya");

    this.video = document.createElement("video");
    this.video.className = "video-screen__player";
    this.video.crossOrigin = "anonymous"; // WAJIB diset sebelum .src agar video eksternal boleh dipakai di Canvas/Three.js
    this.video.src = source;
    this.video.preload = "auto";
    this.video.playsInline = true;
    this.video.controls = false;
    this.video.disablePictureInPicture = true;
    this.video.muted = false;
    this.video.volume = 1;
    this.video.addEventListener("ended", this.handleEnded);
    this.video.addEventListener("pause", this.handlePause);
    this.video.addEventListener("seeking", this.handleSeeking);
    this.video.addEventListener("contextmenu", this.handleContextMenu);

    this.skipButton = document.createElement("button");
    this.skipButton.className = "btn-skip-video";
    this.skipButton.type = "button";
    this.skipButton.textContent = "Lewati Video";
    this.skipButton.addEventListener("click", this.handleSkip);
    this.overlay.append(this.video, this.skipButton);
    this.root.appendChild(this.overlay);
    this.video.load();
    void this.video.play().catch(() => undefined);
  }

  playLevel1(onComplete: () => void): void {
    this.play("https://res.cloudinary.com/ujxsrtnw/video/upload/portal-lvl1.mp4", onComplete);
  }

  playLevel2(onComplete: () => void): void {
    this.play("https://res.cloudinary.com/ujxsrtnw/video/upload/portal-lvl2.mp4", onComplete);
  }

  private readonly handleEnded = (): void => {
    this.finish();
  };

  private readonly handleSkip = (): void => {
    this.finish();
  };

  private finish(invokeCallback = true): void {
    if (this.isFinished) {
      return;
    }

    this.isFinished = true;
    const video = this.video;
    const overlay = this.overlay;
    const skipButton = this.skipButton;
    video?.pause();
    video?.removeEventListener("ended", this.handleEnded);
    video?.removeEventListener("pause", this.handlePause);
    video?.removeEventListener("seeking", this.handleSeeking);
    video?.removeEventListener("contextmenu", this.handleContextMenu);
    skipButton?.removeEventListener("click", this.handleSkip);
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
    overlay?.remove();
    this.video = null;
    this.overlay = null;
    this.skipButton = null;
    const onComplete = this.onComplete;
    this.onComplete = null;
    if (invokeCallback) {
      onComplete?.();
    }
  };

  private readonly handlePause = (): void => {
    const video = this.video;
    if (video && !this.isFinished && !video.ended && video.currentTime < video.duration - 0.05) {
      void video.play().catch(() => undefined);
    }
  };

  private readonly handleSeeking = (): void => {
    if (this.isResetting) {
      this.isResetting = false;
      return;
    }

    if (this.video && !this.isFinished) {
      this.video.currentTime = 0;
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}