import { GameState } from "../core/GameState";
import { LevelManager } from "../core/LevelManager";

export class Level1UI {
  private readonly root: HTMLDivElement;
  private readonly counter: HTMLDivElement;
  private foundCount = 0;

  constructor(
    private readonly uiLayer: HTMLElement,
    private readonly gameState: GameState,
    private readonly levelManager: LevelManager,
  ) {
    this.root = document.createElement("div");
    this.root.className = "level1-ui";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="level1-ui__counter" aria-live="polite">Tikus Ditemukan: 0 / 3</div>
      <div class="level1-ui__modal" role="dialog" aria-modal="true" aria-labelledby="level1-modal-title">
        <div class="level1-ui__card">
          <p class="level1-ui__kicker">LEVEL 1 / ERA KOLONIAL 1911</p>
          <h2 id="level1-modal-title"></h2>
          <p class="level1-ui__message"></p>
          <button class="level1-ui__confirm" type="button">Saya Mengerti</button>
          <button class="level1-ui__continue" type="button" hidden>Lanjut ke Era Kemerdekaan</button>
        </div>
      </div>
    `;
    this.uiLayer.appendChild(this.root);
    this.counter = this.getElement<HTMLDivElement>(".level1-ui__counter");
  }

  showMission(): void {
    this.foundCount = 0;
    this.root.classList.add("level1-ui--mission");
    this.root.classList.remove("level1-ui--evaluation");
    this.root.querySelector<HTMLElement>(".level1-ui__modal")?.removeAttribute("hidden");
    this.uiLayer.querySelector<HTMLElement>("#hud")?.setAttribute("hidden", "true");
    this.counter.textContent = "Tikus Ditemukan: 0 / 3";
    this.setModal(
      "Misi Pembersihan Wabah",
      `Agen ${this.gameState.playerName}, Malang sedang dilanda wabah Pes! Penyakit mematikan ini menyebar lewat kutu pada tikus. Temukan dan bersihkan 3 sarang tikus di rumah ini!`,
      false,
    );
    this.root.hidden = false;
  }

  ratFound(): void {
    this.foundCount += 1;
    this.counter.textContent = `Tikus Ditemukan: ${this.foundCount} / 3`;

    if (this.foundCount === 3) {
      this.root.classList.remove("level1-ui--mission");
      this.root.classList.add("level1-ui--evaluation");
      this.gameState.addScore(100);
      this.setModal(
        "Evaluasi Misi",
        "Tepat sekali! Pahlawan nasional Dr. Cipto Mangunkusumo turun langsung menangani wabah ini. Merespons krisis, pemerintah kolonial akhirnya menerapkan karantina wilayah dan perbaikan rumah bambu.",
        true,
      );
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.uiLayer.querySelector<HTMLElement>("#hud")?.removeAttribute("hidden");
  }

  private setModal(title: string, message: string, showContinue: boolean): void {
    this.getElement<HTMLHeadingElement>("h2").textContent = title;
    this.getElement<HTMLParagraphElement>(".level1-ui__message").textContent = message;
    const continueButton = this.getElement<HTMLButtonElement>(".level1-ui__continue");
    const confirmButton = this.getElement<HTMLButtonElement>(".level1-ui__confirm");
    confirmButton.hidden = showContinue;
    continueButton.hidden = !showContinue;
    confirmButton.onclick = () => {
      this.root.querySelector<HTMLElement>(".level1-ui__modal")?.setAttribute("hidden", "true");
    };
    continueButton.onclick = () => {
      this.levelManager.loadLevel2();
      this.hide();
    };
  }

  private getElement<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Level 1 UI element ${selector} is missing`);
    }
    return element;
  }
}