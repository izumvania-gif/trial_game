// Keyboard + mouse state for the stages. Stages read it every frame; it never blocks the DOM UI.

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 };
  private clicked = false;
  /** When false (dialogue, menus) the stages see no input. */
  enabled = true;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    target.addEventListener('mousemove', (e) => {
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    target.addEventListener('mousedown', (e) => {
      this.mouse.buttons = e.buttons;
      this.clicked = true;
    });
    window.addEventListener('mouseup', (e) => (this.mouse.buttons = e.buttons));
  }

  isDown(code: string): boolean {
    return this.enabled && this.down.has(code);
  }

  /** True once per key press. */
  wasPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code);
  }

  /** Like wasPressed, but also while input is disabled (for closing overlays). */
  wasPressedRaw(code: string): boolean {
    return this.pressed.has(code);
  }

  wasClicked(): boolean {
    return this.enabled && this.clicked;
  }

  /** Drop pending presses, e.g. the key that closed a dialogue must not reopen it. */
  flush(): void {
    this.pressed.clear();
    this.clicked = false;
  }

  /** Call at the end of every frame. */
  endFrame(): void {
    this.pressed.clear();
    this.clicked = false;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }
}
