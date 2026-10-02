import { GameState } from "../core/GameState";

export class Level2UI {
  private readonly root: HTMLDivElement;
  private readonly modal: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly message: HTMLParagraphElement;
  private readonly actions: HTMLDivElement;

  constructor(
    private readonly uiLayer: HTMLElement,
    private readonly gameState: GameState,
    private readonly onContinue: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "level2-ui";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="level2-ui__status">ERA KEMERDEKAAN / POS KESEHATAN</div>
      <div class="level2-ui__modal" role="dialog" aria-modal="true" aria-labelledby="level2-modal-title" hidden>
        <div class="level2-ui__card">
          <p class="level2-ui__kicker">LEVEL 2 / MALARIA 1950-AN</p>
          <h2 id="level2-modal-title"></h2>
          <p class="level2-ui__message"></p>
          <div class="level2-ui__actions"></div>
        </div>
      </div>
    `;
    this.uiLayer.appendChild(this.root);
    this.modal = this.getElement<HTMLDivElement>(".level2-ui__modal");
    this.title = this.getElement<HTMLHeadingElement>("h2");
    this.message = this.getElement<HTMLParagraphElement>(".level2-ui__message");
    this.actions = this.getElement<HTMLDivElement>(".level2-ui__actions");
  }

  showMission(): void {
    this.root.hidden = false;
    this.setModal(
      "Misi Malaria",
      `Agen ${this.gameState.playerName}, wabah malaria sedang mengancam masyarakat di wilayah ini! Penyakit malaria ditularkan melalui gigitan nyamuk Anopheles. Seorang warga datang dengan keluhan demam dan menggigil. Amati kondisi pasien dan lingkungan sekitar, lalu tentukan tindakan yang tepat!`,
      [{ label: "Saya Mengerti", onClick: () => this.closeModal() }],
    );
  }

  showDiagnosis(onCorrect: () => void, onIncorrect: () => void): void {
    this.root.hidden = false;
    this.setModal(
      "Diagnosis Pasien",
      "Informasi Pasien: Suhu: 39°C | Keluhan: Demam | Kondisi: Menggigil & Lemas.",
      [
        { label: "A. Periksa Lebih Lanjut untuk Malaria", onClick: onCorrect },
        { label: "B. Biarkan Pasien Melanjutkan Aktivitas", onClick: onIncorrect },
      ],
    );
  }

  showIncorrect(onRetry: () => void): void {
    this.setModal(
      "Evaluasi Diagnosis",
      "❌ Kurang tepat. Demam dan menggigil pada daerah dengan risiko malaria perlu mendapat perhatian dan pemeriksaan lebih lanjut.",
      [{ label: "Kembali Periksa Pasien", onClick: onRetry }],
    );
  }

  showCorrect(onContinue: () => void = this.onContinue, buttonLabel = "Lanjut ke Era Modern"): void {
    this.setModal(
      "Diagnosis Tepat",
      "✅ Benar! Gejala tersebut mengarah pada malaria. Pasien perlu diperiksa lebih lanjut oleh tenaga kesehatan.",
      [{ label: buttonLabel, onClick: onContinue }],
    );
  }

  showCompletion(): void {
    this.setModal(
      "LEVEL 2 SELESAI",
      "✅ Semua pasien telah diperiksa dan kembali ke tempat duduknya. Wabah malaria berhasil ditangani.",
      [{ label: "Lanjut ke Era Modern", onClick: this.onContinue }],
    );
  }

  hide(): void {
    this.root.hidden = true;
    this.modal.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }

  private setModal(
    title: string,
    message: string,
    actions: Array<{ label: string; onClick: () => void }>,
  ): void {
    this.title.textContent = title;
    this.message.textContent = message;
    this.actions.replaceChildren();
    actions.forEach(({ label, onClick }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level2-ui__button";
      button.textContent = label;
      button.addEventListener("click", onClick, { once: true });
      this.actions.appendChild(button);
    });
    this.modal.hidden = false;
    this.uiLayer.querySelector<HTMLElement>("#hud")?.setAttribute("hidden", "true");
  }

  private closeModal(): void {
    this.modal.hidden = true;
    this.uiLayer.querySelector<HTMLElement>("#hud")?.removeAttribute("hidden");
  }

  private getElement<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Level 2 UI element ${selector} is missing`);
    }
    return element;
  }
}
