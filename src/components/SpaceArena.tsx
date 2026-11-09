import { useEffect, useRef } from "react";
import { gameStore } from "@/store/gameStore";
import { createSpaceArenaScene } from "./PhaserArena";

type SpaceArenaProps = {
  paused?: boolean;
};

const SpaceArena = ({ paused = false }: SpaceArenaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneKeyRef = useRef<string>("SpaceArenaScene");
  const userId = gameStore.getState().user?.id;

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let mounted = true;

    const boot = async () => {
      const Phaser = await import("phaser");
      if (!mounted || !containerRef.current) {
        return;
      }

      const { collectResource } = gameStore.getState();
      const { consumeEnergy } = gameStore.getState();
      const { damagePlayer } = gameStore.getState();
      const SpaceArenaScene = createSpaceArenaScene(
        Phaser,
        collectResource,
        consumeEnergy,
        damagePlayer
      );

      const width = containerRef.current.clientWidth || window.innerWidth;
      const height = containerRef.current.clientHeight || window.innerHeight;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width,
        height,
        parent: containerRef.current,
        backgroundColor: "#0f1116",
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: "arcade",
          arcade: {
            debug: false,
          },
        },
        scene: SpaceArenaScene,
      });
      gameRef.current = game;
      // `createSpaceArenaScene()` sets `key: "SpaceArenaScene"`.
      sceneKeyRef.current = "SpaceArenaScene";

      const resize = () => {
        const nextWidth = containerRef.current?.clientWidth ?? window.innerWidth;
        const nextHeight =
          containerRef.current?.clientHeight ?? window.innerHeight;
        game?.scale.resize(nextWidth, nextHeight);
      };
      window.addEventListener("resize", resize);
      game.events.once("destroy", () => {
        window.removeEventListener("resize", resize);
      });
    };

    void boot();

    return () => {
      mounted = false;
      if (game) {
        game.destroy(true);
      }
      if (gameRef.current === game) {
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) {
      return;
    }
    if (paused) {
      try {
        game.scene.pause(sceneKeyRef.current);
      } catch {
        // fallback: pause all scenes
        game.scene.getScenes(false).forEach((scene) => scene.scene.pause());
      }
    } else {
      try {
        game.scene.resume(sceneKeyRef.current);
      } catch {
        // fallback: resume all scenes (including paused ones)
        game.scene.getScenes(false).forEach((scene) => scene.scene.resume());
      }
    }
  }, [paused]);

  // Passive health regen should not be tied to actions like collecting/shooting.
  // Poll the player endpoint periodically to apply regen server-side.
  useEffect(() => {
    if (!userId) {
      return;
    }
    const id = window.setInterval(() => {
      void gameStore.getState().loadPlayer();
    }, 3000);
    return () => window.clearInterval(id);
  }, [userId]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    />
  );
};

export default SpaceArena;



