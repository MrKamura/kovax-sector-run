# Sound effects

## Level-up fanfare (optional)

Place a file named `levelup.ogg` here to play a custom fanfare when the player levels up.

If the file is missing, the game uses a synthesized fanfare.

## Skill use (optional)

Place a file named `skill_use.ogg` here to play when the player activates a skill from the bar (e.g. continuous laser). If the file is missing, no sound plays on skill use.

## Continuous laser / heat vision (optional)

Place a file named `continuous_laser.ogg` here for the continuous laser skill (looped, ~5 s). If the file is missing, the game uses a synthesized heat-vision style sound (saw wave + lowpass).

**Free sources (download and convert to OGG if needed):**
- [Freesound: Level-Up Sound FX](https://freesound.org/people/elmasmalo1/sounds/350841/) (CC BY 3.0)
- [Freesound: Level Up 01](https://freesound.org/people/rhodesmas/sounds/320655/) (CC BY 3.0)
- [OpenGameArt: Level up sound effects](https://opengameart.org/content/level-up-sound-effects)

To download with the project script (if the URL returns a direct file):
```bash
node scripts/download.js "https://example.com/levelup.ogg" public/assets/sfx/levelup.ogg
```
