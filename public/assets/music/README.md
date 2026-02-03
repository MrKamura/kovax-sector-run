# Game music

- **level32.ogg** – main background music.
- **SpacyLoop.ogg** – used as fallback if the low-health track fails to load.
- **tension_low_health.ogg** – plays when player health is below 25%. **You add this file yourself** (see below).

---

## Low-health tension track (choose and download yourself)

The game plays **`tension_low_health.ogg`** when health drops below 25%. There is no built-in download; you choose a track and add it to the project.

### 1. Where to put the file

Put your file here (exact name):

```
public/assets/music/tension_low_health.ogg
```

- **Format:** OGG is preferred (good browser support, small size).  
- **Name:** Must be `tension_low_health.ogg` or `tension_low_health.mp3`. The game tries OGG first, then MP3, then SpacyLoop.

### 2. Where to find tension / danger / hard-core loops

Download a **short looping** track (tension, danger, suspense, combat, etc.) and save/convert it as `tension_low_health.ogg`.

**Free music (check license for your use):**

| Site | Search / page | Notes |
|------|----------------|--------|
| **OpenGameArt.org** | https://opengameart.org/art-search-advanced?keys=tension+loop&field_art_type_tid[]=12 | Music tag “tension”, “loop”. Filter by license (e.g. CC0, CC-BY). |
| **OpenGameArt – Suspense/Tension** | https://opengameart.org/content/suspensetension-theme | Single tension theme (MP3); convert to OGG or rename and add MP3 support in code. |
| **OpenGameArt – Dark Ambience** | https://opengameart.org/content/dark-ambience-loop | Loop for horror/chase; OGG/MP3. |
| **Freesound.org** | https://freesound.org/search/?q=tension+loop+music&g=1 | Search “tension loop music”; check license (e.g. CC0, CC-BY). |
| **itch.io – CC0 game music** | https://itch.io/game-assets/tag-cc0/tag-music | CC0 music packs; pick a tension/danger loop. |
| **Pixabay (Music)** | https://pixabay.com/music/search/tension/ | Free for commercial use; download and convert to OGG if needed. |

**Convert MP3 → OGG (if needed):**

- **Audacity** (free): File → Export → Export as OGG.  
- **Online:** e.g. “convert mp3 to ogg” in a search engine and use a converter, then save as `tension_low_health.ogg`.

### 3. After adding the file

1. Save your track as `public/assets/music/tension_low_health.ogg`.  
2. Restart or refresh the game so it loads the new file.  
3. In-game, drop health below 25% to hear the track (main music will duck).

If `tension_low_health.ogg` is missing, the game falls back to **SpacyLoop.ogg** so low-health mode still has music.
