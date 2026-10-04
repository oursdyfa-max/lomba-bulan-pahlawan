import * as THREE from "three";
import { GameState } from "../core/GameState";
import { Player } from "../entities/Player";
import { loadGLTF } from "../core/AssetLoader";
import { playMenuAudio } from "../core/MenuAudio";
import { playBenar, playSalah } from "../core/Sfx";

const QUIZ_LEVEL3 = [
  {
    question: "Salah satu upaya untuk mengurangi penyebaran COVID-19 adalah...",
    options: [
      "Pembatasan sosial",
      "Mengabaikan gejala",
      "Menghentikan pemeriksaan",
      "Menghindari semua fasilitas kesehatan",
    ],
    correctIndex: 0,
  },
  {
    question: "Apa tujuan utama vaksinasi dalam menghadapi pandemi?",
    options: [
      "Menggantikan seluruh pemeriksaan medis",
      "Membuat seseorang tidak perlu menjaga kesehatan",
      "Membantu memberikan perlindungan terhadap penyakit",
      "Menghilangkan semua virus secara langsung",
    ],
    correctIndex: 2,
  },
  {
    question: "PCR digunakan dalam konteks pandemi COVID-19 terutama untuk...",
    options: [
      "Mengganti vaksinasi",
      "Mengukur tekanan darah",
      "Mengukur tinggi badan",
      "Membantu mendeteksi materi genetik virus",
    ],
    correctIndex: 3,
  },
] as const;

export class Level3 {
  private isActive = false;
  private isDisposed = false;
  private assetsRequested = false;
  private model: THREE.Object3D | null = null;
  private overlay: HTMLDivElement | null = null;
  private videoOverlay: HTMLDivElement | null = null;
  private quizIndex = 0;
  private quizScore = 0;

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly gameState: GameState,
    private readonly player: Player,
    private readonly onVideoFinished: () => void,
  ) {}

  startTransition(): void {
    this.finishVideo(false);

    this.videoOverlay = document.createElement("div");
    this.videoOverlay.id = "level3-video-overlay";
    Object.assign(this.videoOverlay.style, {
      position: "fixed", inset: "0", zIndex: "3000", background: "#000",
      display: "flex", justifyContent: "center", alignItems: "center",
    });

    const video = document.createElement("video");
    video.id = "video-lvl3";
    video.src = new URL("../../assets/Level3/portal-lvl3.mp4", import.meta.url).href;
    video.autoplay = true;
    video.playsInline = true;
    Object.assign(video.style, { width: "100%", height: "100%", objectFit: "cover" });
    video.addEventListener("ended", () => this.finishVideo(true));

    const skipButton = document.createElement("button");
    skipButton.type = "button";
    skipButton.className = "btn-skip-video";
    skipButton.textContent = "Lewati Video";
    skipButton.addEventListener("click", () => this.finishVideo(true));

    this.videoOverlay.append(video, skipButton);
    document.body.appendChild(this.videoOverlay);
    void video.play().catch(() => undefined);
  }

  private finishVideo(invokeCallback: boolean): void {
    const overlay = this.videoOverlay;
    if (!overlay) return;
    const video = overlay.querySelector("video");
    video?.pause();
    video?.removeAttribute("src");
    video?.load();
    overlay.remove();
    this.videoOverlay = null;
    if (invokeCallback) this.onVideoFinished();
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.player.setControlsEnabled(false);
    this.player.mesh.visible = false;
    // Kamera statis sesuai koordinat POV final.
    this.camera.position.set(0.30, 6.60, 4.90);
    this.camera.rotation.set(-0.29, 0.0, 0.0);
    if (!this.assetsRequested) {
      this.assetsRequested = true;
      void this.loadAssets();
    }
  }

  update(_deltaTime: number): void {
    // Kamera statis — tidak ada pergerakan/pointer lock/orbit.
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.finishVideo(false);
    this.overlay?.remove();
    this.overlay = null;
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject(this.model);
      this.model = null;
    }
  }

  private async loadAssets(): Promise<void> {
    try {
      const gltf = await loadGLTF(
        new URL("../../assets/Level3/RumahSakit.glb", import.meta.url).href,
      );
      if (this.isDisposed) return;
      const model = gltf.scene;
      model.name = "RumahSakitLevel3";
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.model = model;
      this.scene.add(model);
      this.buildOverlay();
      this.showPanel("panel-misi");
    } catch (error) {
      console.error("Gagal memuat RumahSakit.glb:", error);
    }
  }

  // ---------- UI SEQUENTIAL ----------

  private buildOverlay(): void {
    const overlay = document.createElement("div");
    overlay.id = "level3-overlay";
    overlay.className = "game-popup-overlay";
    overlay.style.zIndex = "2000";

    const playerName = this.gameState.playerName || "Dokter Djawa";

    overlay.innerHTML = `
      <!-- a. PANEL MISI -->
      <div id="panel-misi" class="l3-panel game-popup-box" style="display:none">
        <h2 class="game-popup-title">🦠 MISI 03 — KRISIS PANDEMI</h2>
        <p class="game-popup-text" style="text-align:left">Agen <strong>${playerName}</strong>, pandemi COVID-19 sedang berlangsung. Anda bertugas membantu mengarahkan pasien ke jalur yang tepat berdasarkan informasi pemeriksaan yang tersedia. Periksa kondisi pasien dan buat keputusan!</p>
        <button id="btn-misi-start" class="game-popup-btn">MULAI PEMERIKSAAN</button>
      </div>

      <!-- b. PANEL PASIEN 1 -->
      <div id="panel-pasien1" class="l3-panel game-popup-box" style="display:none">
        <h2 class="game-popup-title">Pasien 1:</h2>
        <ul class="game-popup-text" style="text-align:left; line-height:1.8">
          <li>🌡️ Suhu: 39°C</li><li>🤒 Demam</li><li>😷 Batuk</li>
          <li>😮‍💨 Mengeluh sulit bernapas</li><li>🥱 Tubuh lemas</li>
        </ul>
        <p class="game-popup-text">“Berdasarkan kondisi pasien, tindakan mana yang paling tepat?”</p>
        <button class="opt game-popup-option" data-correct="true">A. Arahkan ke Jalur Pemeriksaan / Isolasi</button>
        <button class="opt game-popup-option" data-correct="false">B. Arahkan ke Jalur Vaksinasi</button>
        <p id="p1-feedback" style="display:none; text-align:left; font-weight:bold"></p>
        <button id="p1-next" class="game-popup-btn" style="display:none">Lanjut Pasien 2</button>
      </div>

      <!-- c. PANEL PASIEN 2 -->
      <div id="panel-pasien2" class="l3-panel game-popup-box" style="display:none">
        <h2 class="game-popup-title">Pasien 2:</h2>
        <ul class="game-popup-text" style="text-align:left; line-height:1.8">
          <li>🌡️ Suhu: 36,7°C</li><li>😊 Tidak demam</li><li>🙂 Tidak batuk</li>
          <li>💪 Kondisi tubuh baik</li><li>💉 Belum mendapatkan vaksinasi</li>
        </ul>
        <p class="game-popup-text">“Berdasarkan kondisi pasien, tindakan mana yang paling tepat?”</p>
        <button class="opt game-popup-option" data-correct="false">A. Arahkan ke Jalur Pemeriksaan / Isolasi</button>
        <button class="opt game-popup-option" data-correct="true">B. Arahkan ke Jalur Vaksinasi</button>
        <p id="p2-feedback" style="display:none; text-align:left; font-weight:bold"></p>
        <button id="p2-next" class="game-popup-btn" style="display:none">Lanjut</button>
      </div>

      <!-- d. PANEL SEJARAH -->
      <div id="panel-sejarah" class="l3-panel game-popup-box" style="display:none">
        <h2 class="game-popup-title">📜 INFORMASI SEJARAH LEVEL 3 (KAPSUL SEJARAH)</h2>
        <p class="game-popup-text" style="text-align:justify">Pandemi COVID-19 membawa tantangan besar bagi Indonesia dan dunia. Berbagai upaya dilakukan untuk mengurangi penyebaran penyakit, termasuk pembatasan kegiatan masyarakat, penggunaan masker, pengujian, isolasi, serta vaksinasi. Pengalaman ini menunjukkan bagaimana strategi kesehatan masyarakat terus berkembang menghadapi penyakit menular.</p>
        <button id="btn-ke-kuis" class="game-popup-btn">LANJUT KE KUIS</button>
      </div>

      <!-- e. PANEL KUIS -->
      <div id="panel-kuis" class="l3-panel quiz-container" style="display:none">
        <h2 class="quiz-title">KUIS LEVEL 3</h2>
        <p id="kuis-soal" class="quiz-question" style="text-align:left"></p>
        <div id="kuis-opsi" class="quiz-options"></div>
        <p id="kuis-feedback" class="quiz-feedback" style="display:none; text-align:left"></p>
        <button id="kuis-next" class="quiz-next-btn" style="display:none">Pertanyaan Selanjutnya</button>
      </div>

      <!-- f. PANEL HASIL -->
      <div id="panel-hasil" class="l3-panel game-popup-box" style="display:none">
        <h2 class="game-popup-title">11. 🏆 HASIL LEVEL 3</h2>
        <h3>LEVEL 3 SELESAI!</h3>
        <p class="game-popup-text">🌡️ Pemeriksaan: BERHASIL</p>
        <p class="game-popup-text">🧠 Kuis: <span id="hasil-kuis">0/3</span></p>
        <p class="game-popup-text">🏅 Lencana: AGEN KESEHATAN MODERN</p>
        <button id="btn-laporan" class="game-popup-btn">LIHAT LAPORAN MISI</button>
      </div>
    `;

    // Sembunyikan semua panel, tampilkan hanya yang dipilih lewat showPanel
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Navigasi utama
    overlay.querySelector("#btn-misi-start")?.addEventListener("click", () => this.showPanel("panel-pasien1"));
    overlay.querySelector("#p1-next")?.addEventListener("click", () => this.showPanel("panel-pasien2"));
    overlay.querySelector("#p2-next")?.addEventListener("click", () => this.showPanel("panel-sejarah"));
    overlay.querySelector("#btn-ke-kuis")?.addEventListener("click", () => {
      this.quizIndex = 0;
      this.quizScore = 0;
      this.renderQuiz();
      this.showPanel("panel-kuis");
    });
    overlay.querySelector("#kuis-next")?.addEventListener("click", () => this.nextQuiz());
    overlay.querySelector("#btn-laporan")?.addEventListener("click", () => {
      overlay.style.display = "none";
      this.showEndGame();
    });

    // Pasien 1 & 2: evaluasi jawaban
    this.wirePatientPanel(overlay, "#panel-pasien1", "#p1-feedback",
      "✅ Tepat! Pasien memiliki beberapa gejala yang perlu mendapat pemeriksaan lebih lanjut. Arahkan pasien ke jalur pemeriksaan dan isolasi sesuai prosedur dalam simulasi.",
      "❌ Jawaban kurang tepat. Pasien menunjukkan gejala sakit, sehingga tidak boleh divaksinasi melainkan harus diperiksa/diisolasi.",
      "#p1-next");
    this.wirePatientPanel(overlay, "#panel-pasien2", "#p2-feedback",
      "✅ Tepat! Pasien tidak menunjukkan gejala dalam skenario dan dapat diarahkan ke jalur vaksinasi.",
      "❌ Jawaban kurang tepat. Pasien sehat dan belum divaksin, sehingga jalurnya adalah vaksinasi, bukan isolasi.",
      "#p2-next");
  }

  private wirePatientPanel(
    overlay: HTMLElement,
    panelSelector: string,
    feedbackSelector: string,
    benarText: string,
    salahText: string,
    nextSelector: string,
  ): void {
    const panel = overlay.querySelector<HTMLElement>(panelSelector);
    if (!panel) return;
    const feedback = overlay.querySelector<HTMLElement>(feedbackSelector);
    const nextBtn = overlay.querySelector<HTMLButtonElement>(nextSelector);
    panel.querySelectorAll<HTMLButtonElement>("button.opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        panel.querySelectorAll<HTMLButtonElement>("button.opt").forEach((b) => (b.disabled = true));
        const correct = btn.dataset.correct === "true";
        if (correct) {
          playBenar();
        } else {
          playSalah();
        }
        if (feedback) {
          feedback.textContent = correct ? benarText : salahText;
          feedback.style.display = "block";
          feedback.style.color = correct ? "#18844b" : "#b03a2e";
        }
        if (nextBtn) nextBtn.style.display = "block";
      });
    });
  }

  private renderQuiz(): void {
    const overlay = this.overlay;
    if (!overlay) return;
    const quiz = QUIZ_LEVEL3[this.quizIndex];
    const soalEl = overlay.querySelector<HTMLElement>("#kuis-soal");
    const opsiEl = overlay.querySelector<HTMLElement>("#kuis-opsi");
    const feedback = overlay.querySelector<HTMLElement>("#kuis-feedback");
    const nextBtn = overlay.querySelector<HTMLButtonElement>("#kuis-next");
    if (!quiz || !soalEl || !opsiEl || !feedback || !nextBtn) return;

    soalEl.textContent = `Soal ${this.quizIndex + 1}: ${quiz.question}`;
    feedback.style.display = "none";
    feedback.className = "quiz-feedback";
    nextBtn.style.display = "none";
    nextBtn.textContent = this.quizIndex === QUIZ_LEVEL3.length - 1 ? "Lihat Hasil" : "Pertanyaan Selanjutnya";
    opsiEl.replaceChildren();

    quiz.options.forEach((label, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option-btn";
      btn.textContent = `${String.fromCharCode(65 + index)}. ${label}`;
      btn.addEventListener("click", () => {
        opsiEl.querySelectorAll<HTMLButtonElement>("button").forEach((b, i) => {
          b.disabled = true;
          if (i === quiz.correctIndex) b.classList.add("quiz-btn-correct");
          else if (i === index) b.classList.add("quiz-btn-wrong");
        });
        const correct = index === quiz.correctIndex;
        if (correct) {
          this.quizScore += 1;
          playBenar();
        } else {
          playSalah();
        }
        feedback.textContent = correct ? "✅ Benar!" : "❌ Salah. Coba pelajari kembali.";
        feedback.className = `quiz-feedback ${correct ? "quiz-feedback--correct" : "quiz-feedback--wrong"}`;
        feedback.style.display = "block";
        nextBtn.style.display = "block";
      });
      opsiEl.appendChild(btn);
    });
  }

  private nextQuiz(): void {
    this.quizIndex += 1;
    if (this.quizIndex < QUIZ_LEVEL3.length) {
      this.renderQuiz();
      return;
    }
    const overlay = this.overlay;
    if (!overlay) return;
    const hasil = overlay.querySelector<HTMLElement>("#hasil-kuis");
    if (hasil) hasil.textContent = `${this.quizScore}/${QUIZ_LEVEL3.length}`;
    try { localStorage.setItem("quiz_correct_level3", String(this.quizScore)); } catch { /* ignore */ }
    this.showPanel("panel-hasil");
  }

  // ---------- END GAME SEQUENCE ----------

  private showEndGame(): void {
    try { localStorage.setItem("quiz_correct_level3", String(this.quizScore)); } catch { /* ignore */ }
    const getCorrect = (key: string): number => {
      try {
        const value = Number(localStorage.getItem(key) ?? "0");
        return Number.isFinite(value) ? Math.max(0, Math.min(3, value)) : 0;
      } catch {
        return 0;
      }
    };
    const totalCorrect =
      getCorrect("quiz_correct_level1") + getCorrect("quiz_correct_level2") + getCorrect("quiz_correct_level3");
    const finalScore = Math.round((totalCorrect / 9) * 100);
    const title = finalScore >= 100 ? "AGEN AHLI" : finalScore >= 70 ? "AGEN BERPENGALAMAN" : "AGEN PEMULA";
    const playerName = this.gameState.playerName || "Guest";

    const overlay = document.createElement("div");
    overlay.id = "endgame-overlay";
    overlay.style.cssText =
      "width:100vw; height:100vh; position:fixed; top:0; left:0; z-index:3000; " +
      "background: radial-gradient(circle at center, #1a2a6c, #112 80%); " +
      "display:flex; justify-content:center; align-items:center; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; color:#eee;";

    const cardStyle = "display:none;";
    const btnStyle = "width:100%;";

    overlay.innerHTML = `
      <div id="panel-end-intro" class="end-panel game-popup-box" style="${cardStyle}">
        <div style="font-size:64px; animation:badgeBounce 1.2s infinite alternate">🏅</div>
        <h2 class="game-popup-title">🏆 AKHIR PERMAINAN</h2>
        <h3>🎉 KAMU HEBAT!</h3>
        <p class="game-popup-text">Terima kasih atas dedikasimu, Agen <span id="end-player-name1" style="color:#f1c40f">${playerName}</span>.</p>
        <p class="game-popup-text">Kamu telah menjelajahi perjalanan sejarah kesehatan Indonesia melalui tiga era.</p>
        <button id="end-next-1" class="game-popup-btn">LANJUT</button>
      </div>

      <div id="panel-end-report" class="end-panel game-popup-box" style="${cardStyle} text-align:left">
        <h2 class="game-popup-title" style="text-align:center">📊 LAPORAN MISI</h2>
        <p class="game-popup-text"><strong>Nama Agen:</strong> <span id="end-player-name2" style="color:#f1c40f; font-weight:bold;">${playerName}</span></p>
        <p class="game-popup-text"><strong>Era yang diselesaikan:</strong><br>
          ✓ Era Kolonial — Wabah Pes<br>
          ✓ Era Kemerdekaan — Pemberantasan Cacar / Malaria<br>
          ✓ Era Modern — COVID-19
        </p>
        <p class="game-popup-text"><strong>Misi utama:</strong> <span style="color:#27ae60;">3/3 berhasil</span></p>
        <p class="game-popup-text"><strong>Jawaban benar:</strong> <span id="end-total-correct">${totalCorrect}/9</span></p>
        <p class="game-popup-text"><strong>Skor akhir:</strong> <span id="end-final-score" style="color:#3498db; font-weight:bold;">${finalScore}</span></p>
        <p class="game-popup-text"><strong>🏆 Predikat:</strong> <span id="end-title" style="color:#e74c3c; font-weight:bold;">${title}</span></p>
        <button id="end-next-2" class="game-popup-btn" style="${btnStyle}">LANJUT</button>
      </div>

      <div id="panel-end-badge" class="end-panel game-popup-box" style="${cardStyle}">
        <div style="font-size:64px">🏅</div>
        <h2 class="game-popup-title">🏅 DETEKTIF SEJARAH MEDIS</h2>
        <p class="game-popup-text">Diberikan kepada Agen <span id="end-player-name3" style="color:#f1c40f">${playerName}</span></p>
        <p class="game-popup-text">Karena telah berhasil menyelesaikan seluruh simulasi dan mempelajari perjalanan penanganan penyakit menular dari masa ke masa.</p>
        <button id="end-next-3" class="game-popup-btn">LANJUT</button>
      </div>

      <div id="panel-end-actions" class="end-panel game-popup-box" style="${cardStyle}">
        <h2 class="game-popup-title">PILIHAN AKHIR</h2>
        <button id="btn-main-lagi" class="game-popup-btn" style="${btnStyle}">🔄 MAIN LAGI</button>
        <button id="btn-ke-menu" class="game-popup-btn" style="${btnStyle}; background:#7f8c8d">🏠 KEMBALI KE MENU</button>
      </div>
    `;

    const styleTag = document.createElement("style");
    styleTag.textContent = "@keyframes badgeBounce { from { transform: scale(1); } to { transform: scale(1.25); } }";
    overlay.appendChild(styleTag);
    document.body.appendChild(overlay);

    const showEndPanel = (id: string): void => {
      overlay.querySelectorAll<HTMLElement>(".end-panel").forEach((panel) => {
        panel.style.display = panel.id === id ? "block" : "none";
      });
    };

    overlay.querySelector("#end-next-1")?.addEventListener("click", () => showEndPanel("panel-end-report"));
    overlay.querySelector("#end-next-2")?.addEventListener("click", () => showEndPanel("panel-end-badge"));
    overlay.querySelector("#end-next-3")?.addEventListener("click", () => showEndPanel("panel-end-actions"));
    overlay.querySelector("#btn-main-lagi")?.addEventListener("click", () => {
      // Simpan nama agen, reset skor & progres kuis, lalu reload penuh ke Level 1.
      const savedName = this.gameState.playerName;
      try {
        localStorage.removeItem("quiz_correct_level1");
        localStorage.removeItem("quiz_correct_level2");
        localStorage.removeItem("quiz_correct_level3");
        const freshState = JSON.stringify({ playerName: savedName, score: 0, currentLevel: "START" });
        localStorage.setItem("dokter_djawa_state", freshState);
        sessionStorage.setItem("dokter_djawa_state", freshState);
        localStorage.setItem("dokter_djawa_restart", "1");
      } catch { /* ignore */ }
      window.location.href = "index.html";
    });
    overlay.querySelector("#btn-ke-menu")?.addEventListener("click", () => {
      this.gameState.resetState();
      playMenuAudio();
      window.location.href = "index.html";
    });

    showEndPanel("panel-end-intro");
  }

  private showPanel(id: string): void {
    const overlay = this.overlay;
    if (!overlay) return;
    overlay.style.display = "flex";
    overlay.querySelectorAll<HTMLElement>(".l3-panel").forEach((panel) => {
      panel.style.display = panel.id === id ? "block" : "none";
    });
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.dispose();
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
      });
    });
  }
}
