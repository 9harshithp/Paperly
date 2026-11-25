# Paperly · Paper Plane Adventure

A standalone PixiJS 8.23.0 flight game reconstructed from public descriptions and imagery of Paperly. The game includes 15 named chapter routes, Story and Endless modes, two-pilot private races, 11 paper planes and seven skins. It stores the player's Quantum balance, equipment, chapter progress and flight history in the browser.

## Run locally

Use Node.js 20 or newer. Extract the ZIP, open the paperly directory, and run:

```sh
npm start
```

Open <http://localhost:8080>. The project bundles PixiJS, fonts and artwork and requires no package installation. To serve it from an existing static host, deploy the contents of `dist/` at the site root. WebRTC private races use a STUN service for peer discovery.

## Play

Press Space to launch from chapter select. W/S or the up/down arrows control climb and dive. A/D or the left/right arrows steer horizontally. Hold Shift to boost and press Escape to pause a solo flight. On touch screens, choose a joystick or direction buttons in Settings. 

Story and Private Race start with nine seconds. Fly through every gold checkpoint to replenish the clock, then through the lime finish ring. The plane slows during an off-center finish approach so you can steer into the opening. Quantum crystals are optional. Endless opens every landscape immediately and extends it beyond the story finish. Purple Quantum crystals buy new planes and skins in Hangar. Rings award time or wind. A chapter finish also awards Quantum. Settings, records and purchases are specific to the browser and site origin.

For a private race, both pilots open the game, choose Private race, then exchange invitation and answer codes. The host selects the chapter and launches. The other plane appears when it is in view. Some networks require a TURN relay. This project does not bundle relay credentials or a hosted matchmaking service.

## Edit the project

| File | What to change |
| --- | --- |
| `dist/js/data.js` | Chapter names, lengths, terrain, obstacles, pickup positions, aircraft attributes, prices and skins |
| `dist/js/sim.js` | Fixed-step flight, collision detection, momentum, boost and scoring |
| `dist/js/world.js` | Perspective projection, visible terrain, aircraft, wind trails and pickups |
| `dist/js/main.js` | Menus, inputs, pause, results and saved progression |
| `dist/js/race.js` | WebRTC connection and private race messages |
| `dist/js/sound.js` | Synthesized wind and pickup sounds |
| `dist/style.css`, `dist/index.html` | Game screen and responsive interface |
| `tools/landscapes.py` | Optional deterministic panorama generator using Python, NumPy and Pillow |

Run `npm test` for simulation checks. The tests cover all 15 story finishes using the starter plane, collision outcomes, pickups, momentum, boost and endless flight.

## Reference and fidelity

The CrazyGames listing documents 11 worlds, 11 unlockable aircraft, seven skins, the flight controls and the core pickup mechanics. A public web guide identifies the opening tutorial and 14 additional chapter names. The developer's press kit describes Story and Endless modes.

- [CrazyGames browser listing](https://www.crazygames.com/game/paperly-paper-plane-adventure)
- [Developer press kit](https://abhitechgames.com/paperlypresskit/)
- [Public web gameplay guide](https://www.bubbleshooter.net/game/paperly-paper-plane-adventure/)

The landscape artwork, aircraft illustrations, menus, terrain coordinates, route ordering after the tutorial, physics constants, prices and race connection flow are reconstructions. The project does not contain the original Unity scenes, original leaderboard services, or advertising integrations. PixiJS and font license notices are included beside the bundled files.

The Flight log also shows local chapter bests and achievement progress. Private races support two tabs in the same browser through a local channel. Direct play across separate networks requires a viable WebRTC connection.
