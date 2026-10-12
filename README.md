# Charger Pet ⚡

![Charger Pet preview](docs/preview.png)

A 3D pet that lives on your **charge icon**. A cartoon battery shows your real battery
level, and one of **10 animated heroes** stands on top of it and acts out what the
battery is doing:

- **Plug in:** the cable slides into the battery, energy orbs flow up the wire, the bolt
  lights up and the hero cheers. It can also transform into a random hero.
- **Charging:** the hero dances, powers up, runs laps, does backflips, spins and pumps
  energy into the battery.
- **Full:** a victory celebration.
- **On battery:** the hero chills, waves and stretches.
- **Low battery:** the hero droops, naps and begs you to plug it in.

Tap a hero to make it react, drag to look around the 3D scene, and use the dial to switch
heroes. The browser-tab icon (favicon) and page title also show the live charge level.

## The Charge Squad (10 heroes)

| # | Hero | Power | Particle effect |
|---|------|-------|-----------------|
| 1 | Blaze | Fire elemental | rising embers |
| 2 | Volt | Living lightning | electric sparks |
| 3 | Frostbyte | Ice crystal | snowfall |
| 4 | Boulder | Rock golem | dust |
| 5 | Zip | Super speed | speed streaks |
| 6 | Gloop | Slime shifter | bubbles |
| 7 | Sprout | Plant power | petals |
| 8 | Gizmo | Robo tinkerer | workshop sparks |
| 9 | Nova | Cosmic star | twinkling stars |
| 10 | Wisp | Phantom spirit | mist |

All heroes are built in code from 3D primitives (cel shading, outlines, bloom glow).
They share one rig, so every hero can do all 13 activities: idle, wave, jump, backflip,
dance, spin, run, power up, cheer, pump, stretch, sad and sleep.

## Run it

```bash
npm start          # serves the app at http://localhost:8080 (no install needed)
```

Any static file server works too, for example `python3 -m http.server`.

### On your phone

1. Host the folder over HTTPS. For example, turn on **GitHub Pages** for this repo
   (Settings → Pages → Deploy from a branch → root).
2. Open the page in **Chrome on Android** and choose **Add to Home screen**. It installs
   as a full-screen app that works offline.
3. Open it, plug in your charger and watch the pet react. With "Keep the screen on while
   charging" turned on, it works like a charging screen.

## Battery support

The app reads the real battery level through the
[Battery Status API](https://developer.mozilla.org/docs/Web/API/Battery_Status_API).
This works in Chrome, Edge and other Chromium browsers, including Android. Safari and
Firefox don't support the API, so the app switches to **demo mode** there. In demo mode
the **Plug in cable** button and the level slider in Settings simulate charging. You can
also turn on demo mode yourself in Settings.

> A web app can't draw over the phone's status-bar charging icon. To do that, the scene
> would need to be wrapped in a native Android app (for example with Capacitor) that
> shows it on the lock screen when the charger connects.

## Controls

| Action | Input |
|---|---|
| Switch hero | dial, ◀ ▶, or keys ← → / 1–0 |
| Random transform | **Transform** button |
| Make the hero react | tap or click it |
| Look around | drag |
| Plug in/unplug (demo) | **Plug in cable** button or key **P** |

## Project layout

```
index.html            page, HUD and import map
css/style.css         HUD styling (responsive for phone portrait and landscape)
js/main.js            scene, camera, bloom, UI, battery wiring
js/characters.js      the 10 hero definitions and the shared rig
js/activities.js      pose-based activities and the director that picks them
js/charger.js         3D battery/charge icon, plug, cable and energy orbs
js/particles.js       GPU point-sprite particles
js/battery.js         Battery Status API and demo simulator
js/extras.js          live favicon, sound effects, screen wake lock
sw.js                 offline cache (PWA)
vendor/three/         Three.js r170 (MIT), bundled so it works offline
```

### Adding a hero

Add an entry to `HEROES` in `js/characters.js` with colours, body proportions and an
optional `decorate(rig, ctx)` function for accessories. The shared rig and activities do
the rest.
