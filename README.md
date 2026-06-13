# Forge Motors — Car Designer & Proving Ground

A browser-based 3D car designer and test-drive game. Build a car part by
part in a studio showroom, then take it onto a physics-driven proving
ground full of obstacles.

![tech](https://img.shields.io/badge/three.js-r160-blue) ![physics](https://img.shields.io/badge/cannon--es-0.20-green)

## Run it

The game uses ES modules, so it needs to be served over HTTP (a plain
double-click on `index.html` won't work in most browsers):

```bash
cd Games
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).
Three.js and cannon-es load from a CDN, so the first load needs internet.

## Design Studio

Pick every part and watch the car rebuild live on the turntable:

| Category | Options |
| --- | --- |
| **Body style** | Sports coupe, supercar, sedan, hot hatch, SUV, pickup |
| **Engine** | 2.0L Turbo I4 · 3.0L TT V6 · 6.2L Supercharged V8 · 6.5L V12 · Dual-Motor EV |
| **Tires** | Street, sport, racing slicks, all-terrain, drift spec |
| **Rims** | 5-spoke, aero disc, classic mesh, beadlock steel |
| **Suspension** | Lowered coilovers, sport, comfort, rally long-travel |
| **Spoiler** | None, lip, GT wing |
| **Paint** | 12 swatches + full custom color, in gloss / metallic / matte / pearlescent / chrome |

Every choice changes the real physics: engine power and top speed, tire
grip, suspension stiffness and ride height, drivetrain (FWD/RWD/AWD),
mass, and spoiler downforce. The stats panel shows live numbers.

## Proving Ground

A timed gauntlet plus free-roam terrain:

1. **Slalom** — weave the cones
2. **Speed bumps** — flat out if you dare
3. **Big Air** — jump ramp
4. **Breakthrough** — smash the crate wall
5. **Seesaw** — balance over the pivot
6. **Narrow bridge** — fall in the water and you're recovered to the start of it
7. **Barrel field** — bowling, basically
8. **Off-road moguls** — a real heightfield dirt section beside the track
9. **Skidpad** — past the finish, for donuts

Cross the START gantry to begin the clock; best time is saved locally.

### Controls

| Key | Action |
| --- | --- |
| `W / S` or `↑ / ↓` | Throttle / brake & reverse |
| `A / D` or `← / →` | Steer |
| `Space` | Handbrake (rear grip drops — drift!) |
| `C` | Camera: chase / hood / aerial |
| `R` | Flip upright |
| `T` | Restart at the start line |
| `M` | Mute |
| `Esc` | Back to the garage |

## Tech

- **three.js r160** — PBR materials (clearcoat paint, iridescent pearl),
  procedural sky with sun-matched environment lighting, soft shadows,
  ACES tone mapping. Car bodies are procedurally extruded side
  silhouettes with real wheel-arch cutouts.
- **cannon-es** — raycast-vehicle dynamics: spring/damper suspension per
  wheel, tire friction slip, engine force curves, downforce, a hinged
  seesaw, dynamic cones/crates/barrels, and an off-road heightfield.
- **WebAudio** — fully procedural engine note per engine (V8 burble, V12
  scream, EV whine), wind and tire-squeal layers. No audio files.

No build step, no dependencies to install — it's all vanilla ES modules.
