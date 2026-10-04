import { GameState } from "../core/GameState";
import { LevelManager } from "../core/LevelManager";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "Penyakit Pes pada masa itu berkaitan erat dengan...",
    options: ["Tikus dan kutu", "Nyamuk", "Air laut", "Sinar matahari"],
    correctAnswer: 0,
  },
  {
    question: "Mengapa tikus menjadi perhatian penting dalam wabah Pes?",
    options: [
      "Tikus dapat berkaitan dengan kutu pembawa bakteri penyebab Pes",
      "Tikus menghasilkan udara beracun",
      "Tikus menyebabkan air menjadi asin",
      "Tikus hanya merusak rumah",
    ],
    correctAnswer: 0,
  },
  {
    question: "Siapakah tokoh yang dikenal terlibat dalam penanganan wabah Pes?",
    options: [
      "Dr. Cipto Mangunkusumo",
      "Ki Hajar Dewantara",
      "R.A. Kartini",
      "Mohammad Hatta",
    ],
    correctAnswer: 0,
  },
];

export class Level1UI {
  private readonly root: HTMLDivElement;
  private readonly counter: HTMLDivElement;
  private foundCount = 0;
  private quizIndex = 0;
  private quizCorrect = 0;

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
          <p class="level1-ui__kicker">LEVEL 1 / INFORMASI SEJARAH</p>
          <h2 id="level1-modal-title"></h2>
          <p class="level1-ui__message"></p>
          <div class="level1-ui__quiz" hidden>
            <div class="level1-ui__options" role="group" aria-label="Pilihan jawaban"></div>
            <p class="level1-ui__feedback" aria-live="polite"></p>
            <button class="level1-ui__next" type="button" hidden>SOAL BERIKUTNYA</button>
          </div>
          <button class="level1-ui__confirm" type="button">Saya Mengerti</button>
          <button class="level1-ui__continue" type="button" hidden>LANJUT KE KUIS</button>
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
        "KAPSUL SEJARAH",
        "Wabah Pes pernah menjadi masalah kesehatan serius di Indonesia pada masa kolonial.\n\nPenanganannya mendorong berbagai upaya untuk mengurangi sumber penularan, memperbaiki lingkungan tempat tinggal, dan membatasi penyebaran penyakit.\n\nSalah satu tokoh yang dikenal dalam sejarah penanganan wabah tersebut adalah Dr. Cipto Mangunkusumo.",
        true,
      );
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.uiLayer.querySelector<HTMLElement>("#hud")?.removeAttribute("hidden");
  }

  private setModal(title: string, message: string, showContinue: boolean): void {
    this.root.querySelector<HTMLElement>(".level1-ui__modal")?.removeAttribute("hidden");
    this.getElement<HTMLHeadingElement>("h2").textContent = title;
    this.getElement<HTMLParagraphElement>(".level1-ui__message").textContent = message;
    const continueButton = this.getElement<HTMLButtonElement>(".level1-ui__continue");
    const confirmButton = this.getElement<HTMLButtonElement>(".level1-ui__confirm");
    const quiz = this.getElement<HTMLDivElement>(".level1-ui__quiz");
    quiz.hidden = true;
    confirmButton.hidden = showContinue;
    continueButton.hidden = !showContinue;
    confirmButton.onclick = () => {
      this.root.querySelector<HTMLElement>(".level1-ui__modal")?.setAttribute("hidden", "true");
    };
    continueButton.onclick = () => {
      this.showQuiz();
    };
  }

  private showQuiz(): void {
    this.quizIndex = 0;
    this.quizCorrect = 0;
    this.root.classList.remove("level1-ui--evaluation");
    this.root.classList.add("level1-ui--quiz");
    this.getElement<HTMLButtonElement>(".level1-ui__confirm").hidden = true;
    this.getElement<HTMLButtonElement>(".level1-ui__continue").hidden = true;
    this.getElement<HTMLDivElement>(".level1-ui__quiz").hidden = false;
    this.renderQuizQuestion();
  }

  private renderQuizQuestion(): void {
    const question = QUIZ_QUESTIONS[this.quizIndex];
    if (!question) {
      this.showReward();
      return;
    }

    this.getElement<HTMLHeadingElement>("h2").textContent = `Soal ${this.quizIndex + 1}`;
    this.getElement<HTMLParagraphElement>(".level1-ui__message").textContent = question.question;
    this.getElement<HTMLParagraphElement>(".level1-ui__feedback").textContent = "";
    const nextButton = this.getElement<HTMLButtonElement>(".level1-ui__next");
    nextButton.hidden = true;
    nextButton.textContent = this.quizIndex === QUIZ_QUESTIONS.length - 1 ? "LIHAT HASIL" : "SOAL BERIKUTNYA";

    const options = this.getElement<HTMLDivElement>(".level1-ui__options");
    options.replaceChildren();
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level1-ui__option";
      button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
      button.addEventListener("click", () => this.answerQuestion(index, options));
      options.appendChild(button);
    });
  }

  private answerQuestion(answerIndex: number, options: HTMLDivElement): void {
    const question = QUIZ_QUESTIONS[this.quizIndex];
    if (!question) {
      return;
    }

    const optionButtons = Array.from(options.querySelectorAll<HTMLButtonElement>("button"));
    optionButtons.forEach((button) => {
      button.disabled = true;
    });

    const isCorrect = answerIndex === question.correctAnswer;
    optionButtons[question.correctAnswer]?.classList.add("level1-ui__option--correct");
    if (!isCorrect) {
      optionButtons[answerIndex]?.classList.add("level1-ui__option--wrong");
    } else {
      this.quizCorrect += 1;
    }

    const feedback = this.getElement<HTMLParagraphElement>(".level1-ui__feedback");
    feedback.className = `level1-ui__feedback ${isCorrect ? "level1-ui__feedback--correct" : "level1-ui__feedback--wrong"}`;
    feedback.textContent = isCorrect
      ? "✅ BENAR!\n\nPengetahuanmu membantu misi berjalan lebih baik."
      : `❌ BELUM TEPAT\n\nJangan khawatir, ${this.gameState.playerName}. Perhatikan kembali informasi sejarah yang telah kamu pelajari.`;

    const nextButton = this.getElement<HTMLButtonElement>(".level1-ui__next");
    nextButton.hidden = false;
    nextButton.onclick = () => {
      this.quizIndex += 1;
      this.renderQuizQuestion();
    };
  }

  private showReward(): void {
    this.root.classList.remove("level1-ui--quiz");
    this.root.classList.add("level1-ui--evaluation");
    this.getElement<HTMLHeadingElement>("h2").textContent = "🏅 REWARD LEVEL 1";
    this.getElement<HTMLParagraphElement>(".level1-ui__message").textContent =
      `LEVEL 1 SELESAI\n\n🐀 Tikus ditemukan: ${this.foundCount}/3\n🧠 Kuis: ${this.quizCorrect}/3\n\nLencana diperoleh:\n🏅 DETEKTIF WABAH`;
    try { localStorage.setItem("quiz_correct_level1", String(this.quizCorrect)); } catch { /* ignore */ }
    this.getElement<HTMLDivElement>(".level1-ui__quiz").hidden = true;
    const continueButton = this.getElement<HTMLButtonElement>(".level1-ui__continue");
    continueButton.textContent = "LANJUT KE ERA KEMERDEKAAN";
    continueButton.hidden = false;
    continueButton.onclick = () => {
      this.hide();
      this.levelManager.beginLevel2Transition();
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