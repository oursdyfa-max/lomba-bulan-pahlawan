export class MainMenuScreen {
  private readonly overlay: HTMLDivElement;
  private readonly btnContainer: HTMLDivElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly onStart: () => void,
  ) {
    this.overlay = document.createElement("div");
    this.overlay.id = "main-menu-screen";
    Object.assign(this.overlay.style, {
      width: "100vw",
      height: "100vh",
      position: "fixed",
      top: "0",
      left: "0",
      pointerEvents: "auto",
      backgroundImage: `url('${new URL("../../assets/bg/banner.png", import.meta.url).href}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    });
    this.overlay.style.setProperty("z-index", "9999", "important");

    // Container tombol (diposisikan pakai tuner)
    this.btnContainer = document.createElement("div");
    this.btnContainer.id = "menu-btn-container";
    Object.assign(this.btnContainer.style, {
      position: "absolute",
      top: "56%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      display: "flex",
      flexDirection: "column",
      gap: "15px",
      alignItems: "center",
      pointerEvents: "auto",
    });

    const buttonLabels = ["Petunjuk Permainan", "Mulai Permainan", "Referensi"];
    for (const label of buttonLabels) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      Object.assign(btn.style, {
        padding: "14px 36px",
        fontSize: "18px",
        fontWeight: "bold",
        color: "#ffffff",
        background: "rgba(20, 30, 60, 0.75)",
        border: "2px solid rgba(255,255,255,0.6)",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "background 0.2s, transform 0.15s",
        minWidth: "260px",
        pointerEvents: "auto",
      });
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "rgba(52, 152, 219, 0.85)";
        btn.style.transform = "scale(1.05)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "rgba(20, 30, 60, 0.75)";
        btn.style.transform = "scale(1)";
      });
      if (label === "Mulai Permainan") {
        btn.addEventListener("click", () => {
          this.overlay.style.display = "none";
          this.onStart();
        });
      } else if (label === "Petunjuk Permainan") {
        btn.addEventListener("click", () => {
          const popup = document.getElementById("popup-petunjuk");
          if (popup) popup.style.display = "flex";
        });
      } else {
        btn.addEventListener("click", () => {
          const popup = document.getElementById("popup-referensi");
          if (popup) popup.style.display = "flex";
        });
      }
      this.btnContainer.appendChild(btn);
    }
    this.overlay.appendChild(this.btnContainer);

    // ---- POP-UP PETUNJUK & REFERENSI ----
    const popupOverlayStyle = "display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;";

    const popupPetunjuk = document.createElement("div");
    popupPetunjuk.id = "popup-petunjuk";
    popupPetunjuk.className = "game-popup-overlay";
    popupPetunjuk.style.cssText = popupOverlayStyle;
    popupPetunjuk.innerHTML = `
      <div class="game-popup-box">
        <h2 class="game-popup-title">TATA CARA PENGGUNAAN</h2>
        <ol class="game-popup-text" style="padding-left:20px">
          <li>Murid membuka aplikasi, memasukkan nama pada kolom “Nama Agen”, kemudian klik “MULAI MISI” untuk memulai permainan.</li>
          <li>Murid menjelajahi setiap era dan menyelesaikan berbagai misi serta interaksi, seperti mencari objek tersembunyi, memeriksa pasien, atau menyelesaikan tantangan lainnya.</li>
          <li>Setelah misi selesai, murid akan menemukan “Kapsul Sejarah”. Bacalah informasi tersebut untuk mengetahui berbagai perjuangan dan perkembangan kesehatan di masa lalu.</li>
          <li>Di akhir setiap level, murid harus menjawab 3 soal kuis untuk menguji pemahaman tentang materi yang telah dipelajari.</li>
          <li>Setelah berhasil menyelesaikan seluruh era, murid dapat melihat “Laporan Misi” yang berisi hasil permainan dan total skor yang diperoleh.</li>
          <li>Jika seluruh misi berhasil diselesaikan, murid akan mendapatkan Lencana Utama: “Detektif Sejarah Medis”.</li>
        </ol>
        <button id="popup-petunjuk-close" class="game-popup-btn" style="display:block; margin:20px auto 0">Tutup</button>
      </div>
    `;
    document.body.appendChild(popupPetunjuk);
    popupPetunjuk.querySelector("#popup-petunjuk-close")?.addEventListener("click", () => {
      popupPetunjuk.style.display = "none";
    });

    const popupReferensi = document.createElement("div");
    popupReferensi.id = "popup-referensi";
    popupReferensi.className = "game-popup-overlay";
    popupReferensi.style.cssText = popupOverlayStyle;
    popupReferensi.innerHTML = `
      <div class="game-popup-box">
        <h2 class="game-popup-title">DAFTAR PUSTAKA</h2>
        <h3 style="color:#e8b44f">Materi Pembelajaran</h3>
        <ul class="game-popup-text">
          <li>Luwis, S. (2020). Epidemi penyakit pes di Malang, 1911–1916. Kendi.</li>
          <li>Kementerian Kesehatan RI. (2021). Pencegahan dan Pengendalian Penyakit Modul Muatan Lokal Malaria untuk Tingkat Sekolah Dasar. Jakarta: Kementerian Kesehatan RI.</li>
          <li>World Health Organization. (2020). Disseminating the revised national COVID-19 guidelines. WHO Indonesia.</li>
        </ul>
        <h3 style="color:#e8b44f">Musik dan Audio</h3>
        <ul class="game-popup-text">
          <li>Pixabay. (n.d.). Pixabay: Free music and sound effects. https://pixabay.com/</li>
        </ul>
        <h3 style="color:#e8b44f">Video</h3>
        <ul class="game-popup-text">
          <li>Google. (n.d.). Gemini [Video]. https://gemini.google.com/</li>
        </ul>
        <h3 style="color:#e8b44f">Aset 3D</h3>
        <ul class="game-popup-text">
          <li>Blender Foundation. (n.d.). Blender. Blender Foundation. https://www.blender.org/</li>
        </ul>
        <button id="popup-referensi-close" class="game-popup-btn" style="display:block; margin:20px auto 0">Tutup</button>
      </div>
    `;
    document.body.appendChild(popupReferensi);
    popupReferensi.querySelector("#popup-referensi-close")?.addEventListener("click", () => {
      popupReferensi.style.display = "none";
    });

    root.appendChild(this.overlay);
  }
}
