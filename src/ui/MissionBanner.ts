class MissionBanner {
  private readonly element: HTMLDivElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.id = "mission-banner";
    Object.assign(this.element.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "1000",
      background: "rgba(0,0,0,0.7)",
      color: "white",
      padding: "10px 20px",
      borderRadius: "8px",
      fontSize: "16px",
      fontWeight: "bold",
      pointerEvents: "none",
      display: "none",
      textAlign: "center",
      maxWidth: "90vw",
    });
    document.body.appendChild(this.element);
  }

  show(text: string): void {
    this.element.textContent = text;
    this.element.style.display = "block";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}

export const missionBanner = new MissionBanner();
