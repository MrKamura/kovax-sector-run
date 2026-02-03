import type Phaser from "phaser";

const JOYSTICK_RADIUS = 54;
const FIRE_REPEAT_MS = 160;

export type MobileControlsState = {
  enabled: boolean;
  joystickX: number;
  joystickY: number;
  fireHeld: boolean;
  fireJustPressed: boolean;
  fireRepeatMs: number;
};

export function isTouchDevice(game: Phaser.Game): boolean {
  return (
    !!game.device.input.touch ||
    !!game.device.os.android ||
    !!game.device.os.iOS ||
    (typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0)
  );
}

export function setupMobileControls(
  scene: Phaser.Scene,
  state: MobileControlsState,
  isChatInputFocused: () => boolean
): void {
  state.enabled = isTouchDevice(scene.sys.game);
  state.fireRepeatMs = FIRE_REPEAT_MS;
  if (!state.enabled) return;

  scene.input.addPointer(2);

  const pad = 24;
  const fireR = 46;
  let joystickCenterX = pad + JOYSTICK_RADIUS;
  let joystickCenterY = 0; // set in layout
  let joystickPointerId: number | null = null;
  let firePointerId: number | null = null;

  const joystickBase = scene.add
    .circle(0, 0, JOYSTICK_RADIUS, 0x0f141b, 0.55)
    .setStrokeStyle(2, 0x5a6b7f, 0.65)
    .setScrollFactor(0)
    .setDepth(1000);
  const joystickThumb = scene.add
    .circle(
      0,
      0,
      Math.max(18, Math.floor(JOYSTICK_RADIUS * 0.42)),
      0x9fd9ff,
      0.75
    )
    .setStrokeStyle(2, 0x0f1116, 0.55)
    .setScrollFactor(0)
    .setDepth(1001);
  const fireButton = scene.add
    .circle(0, 0, 46, 0x8ed5ff, 0.2)
    .setStrokeStyle(2, 0x8ed5ff, 0.7)
    .setScrollFactor(0)
    .setDepth(1000);

  const layout = (width: number, height: number) => {
    joystickCenterX = pad + JOYSTICK_RADIUS;
    joystickCenterY = height - pad - JOYSTICK_RADIUS;
    joystickBase.setPosition(joystickCenterX, joystickCenterY);
    joystickThumb.setPosition(joystickCenterX, joystickCenterY);
    fireButton.setPosition(width - pad - fireR, height - pad - fireR);
  };

  layout(scene.scale.width, scene.scale.height);
  scene.scale.on("resize", (gameSize: { width: number; height: number }) => {
    layout(gameSize.width, gameSize.height);
  });

  const inCircle = (
    px: number,
    py: number,
    cx: number,
    cy: number,
    r: number
  ) => {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  };

  const updateJoystick = (pointer: Phaser.Input.Pointer) => {
    const dx = pointer.x - joystickCenterX;
    const dy = pointer.y - joystickCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0;
    const clamp = Math.min(dist, JOYSTICK_RADIUS);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const clampedX = nx * clamp;
    const clampedY = ny * clamp;
    state.joystickX =
      JOYSTICK_RADIUS > 0 ? clampedX / JOYSTICK_RADIUS : 0;
    state.joystickY =
      JOYSTICK_RADIUS > 0 ? clampedY / JOYSTICK_RADIUS : 0;
    joystickThumb.setPosition(
      joystickCenterX + clampedX,
      joystickCenterY + clampedY
    );
  };

  const resetJoystick = () => {
    joystickPointerId = null;
    state.joystickX = 0;
    state.joystickY = 0;
    joystickThumb.setPosition(joystickCenterX, joystickCenterY);
  };

  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (isChatInputFocused()) return;
    if (
      joystickPointerId == null &&
      inCircle(
        pointer.x,
        pointer.y,
        joystickCenterX,
        joystickCenterY,
        JOYSTICK_RADIUS + 14
      )
    ) {
      joystickPointerId = pointer.id;
      updateJoystick(pointer);
      return;
    }
    if (firePointerId == null) {
      const fx = fireButton.x;
      const fy = fireButton.y;
      if (inCircle(pointer.x, pointer.y, fx, fy, 58)) {
        firePointerId = pointer.id;
        state.fireHeld = true;
        state.fireJustPressed = true;
      }
    }
  });

  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    if (pointer.id === joystickPointerId) updateJoystick(pointer);
  });

  const releasePointer = (pointer: Phaser.Input.Pointer) => {
    if (pointer.id === joystickPointerId) resetJoystick();
    if (pointer.id === firePointerId) {
      firePointerId = null;
      state.fireHeld = false;
      state.fireJustPressed = false;
    }
  };

  scene.input.on("pointerup", releasePointer);
  scene.input.on("pointerupoutside", releasePointer);
}
