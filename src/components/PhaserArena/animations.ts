import type Phaser from "phaser";

type KeeperSheetKey = "mob_keeper19" | "mob_keeper20";

function createKeeperAnim(
  scene: Phaser.Scene,
  sheetKey: KeeperSheetKey,
  animKey: string,
  row: number,
  startCol = 0,
  frameCount = 3,
  opts?: { frameRate?: number; repeat?: number }
): void {
  if (scene.anims.exists(animKey)) return;
  const start = row * 9 + startCol;
  const end = start + Math.max(0, frameCount - 1);
  scene.anims.create({
    key: animKey,
    frames: scene.anims.generateFrameNumbers(sheetKey, { start, end }),
    frameRate: opts?.frameRate ?? 6,
    repeat: opts?.repeat ?? -1,
  });
}

/**
 * Creates all Space Arena animations (keeper idles/attack/blind, blackHolePulse).
 * Safe to call multiple times; skips already existing animations.
 */
export function createSpaceArenaAnimations(scene: Phaser.Scene): void {
  // Idle (first 3 frames of row 0)
  createKeeperAnim(scene, "mob_keeper19", "mob_keeper19_idle", 0, 0, 3);
  createKeeperAnim(scene, "mob_keeper20", "mob_keeper20_idle", 0, 0, 3);
  // Attack (eye-laser frames) — must NOT loop
  createKeeperAnim(scene, "mob_keeper19", "mob_keeper19_attack", 0, 3, 3, {
    frameRate: 10,
    repeat: 0,
  });
  createKeeperAnim(scene, "mob_keeper20", "mob_keeper20_attack", 3, 3, 3, {
    frameRate: 10,
    repeat: 0,
  });
  // Blind (last row of each sheet)
  createKeeperAnim(scene, "mob_keeper19", "mob_keeper19_blind", 5, 0, 3);
  createKeeperAnim(scene, "mob_keeper20", "mob_keeper20_blind", 5, 0, 3);

  if (!scene.anims.exists("blackHolePulse")) {
    scene.anims.create({
      key: "blackHolePulse",
      frames: [
        { key: "black_hole_1" },
        { key: "black_hole_2" },
        { key: "black_hole_3" },
      ],
      frameRate: 6,
      repeat: -1,
    });
  }
}
