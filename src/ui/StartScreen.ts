import { GameState } from "../core/GameState";

export class StartScreen {
  private readonly overlay: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
  private readonly startButton: HTMLButtonElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly gameState: GameState,
    private readonly onGameStart: () => void,
  ) {
    this.overlay = document.createElement("div");
    this.overlay.className = "start-screen";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-labelledby", "start-screen-title");

    this.overlay.innerHTML = `
      <div class="start-screen__panel">
        <h1 id="start-screen-title">Pahlawan Imunitas: Menembus Waktu</h1>
        <p class="start-screen__subtitle">Selamat Datang di Simulasi Kapsul Waktu Medis</p>
        <label class="start-screen__label" for="player-name">Identitas Agen</label>
        <input type="text" id="player-name" placeholder="Masukkan Nama Agen..." maxlength="20" autocomplete="name" />
        <button id="btn-start" type="button">Mulai Misi</button>
      </div>
    `;

    this.root.appendChild(this.overlay);
    this.nameInput = this.getElement("player-name");
    this.startButton = this.getElement("btn-start");
    this.nameInput.value = this.gameState.playerName;
    this.startButton.addEventListener("click", this.handleStart);
    this.nameInput.addEventListener("keydown", this.handleInputKeyDown);
  }

  private readonly handleStart = (): void => {
    const playerName = this.nameInput.value.trim();
    if (!playerName) {
      this.nameInput.classList.remove("start-screen__input--invalid");
      void this.nameInput.offsetWidth;
      this.nameInput.classList.add("start-screen__input--invalid");
      this.nameInput.focus();
      return;
    }

    this.gameState.playerName = playerName;
    this.gameState.saveState();
    this.dispose();
    this.onGameStart();
  };

  private readonly handleInputKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      this.handleStart();
    }
  };

  private dispose(): void {
    this.startButton.removeEventListener("click", this.handleStart);
    this.nameInput.removeEventListener("keydown", this.handleInputKeyDown);
    this.overlay.remove();
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = this.overlay.querySelector<T>(`#${id}`);
    if (!element) {
      throw new Error(`Start screen element #${id} is missing`);
    }
    return element;
  }
}