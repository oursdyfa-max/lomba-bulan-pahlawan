import * as THREE from "three";

export class HUD {
  private readonly playerNameElement: HTMLElement;
  private readonly scoreElement: HTMLElement;
  private readonly eraElement: HTMLElement;
  private readonly positionElement: HTMLElement;
  private readonly interactionHintElement: HTMLElement;
  private readonly levelCompleteElement: HTMLElement;

  constructor(root: HTMLElement) {
    this.playerNameElement = this.getElement(root, "player-display");
    this.scoreElement = this.getElement(root, "score-lp");
    this.eraElement = this.getElement(root, "era-indicator");
    this.positionElement = this.getElement(root, "position");
    this.interactionHintElement = this.getElement(root, "interaction-hint");
    this.levelCompleteElement = this.getElement(root, "level-complete");
  }

  update(position: THREE.Vector3): void {
    this.positionElement.textContent = `Posisi: X ${position.x.toFixed(1)} | Y ${position.y.toFixed(1)} | Z ${position.z.toFixed(1)}`;
  }

  setPlayerName(name: string): void {
    this.playerNameElement.textContent = name;
  }

  setScore(score: number): void {
    this.scoreElement.textContent = `Skor LP: ${score}`;
  }

  setEra(era: string): void {
    this.eraElement.textContent = `Era: ${era}`;
  }

  setInteractionHint(visible: boolean): void {
    this.interactionHintElement.hidden = !visible;
  }

  showLevelComplete(): void {
    this.levelCompleteElement.hidden = false;
  }

  private getElement(root: HTMLElement, id: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(`#${id}`);
    if (!element) {
      throw new Error(`HUD element #${id} is missing from index.html`);
    }
    return element;
  }
}