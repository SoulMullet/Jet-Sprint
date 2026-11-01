# One boat / career upgrades and nitrous — v0.29.0

The existing `PlayerCareer`, garage, validated payouts, input pipeline, physics integrator and recorded V8 controller are extended. There is still one owned boat and exactly three upgrade categories: **Engine, Jet Pump, Nitrous**. Courses, checkpoints, timing, engine recordings, music and saved settings are retained.

## Shop and economy

Open Garage from the title, Pause, or results. The former future-fit-out placeholder is now a three-tab performance counter. Each category shows the installed stage, next stage, price, reference MPH/thrust benefit and owned status. Sequential purchases commit before the cash/stage becomes visible. A failed write, stale revision, insufficient balance, duplicate installation or active race attempt cannot grant a purchase. Fuel, hull repairs, emergency dock service, logbook and the shared real-boat preview remain.

| Purchase | Prices |
| --- | --- |
| Engine 1 / 2 / 3 / 4 | $1,000 / $2,500 / $5,000 / $9,000 |
| Pump 1 / 2 / 3 | $750 / $2,000 / $4,500 |
| Nitrous kit | $2,500 once; includes the first full tank |
| Full 100-unit nitrous refill | $150 |

Prices and performance definitions live in `src/garage/upgrades.js`. Partial refills store only available capacity and affordable resource, with integer-dollar costs rounded up. A full tank cannot be charged again. Installation/stage purchases and nitrous refills are between runs; existing fuel/hull services remain available during a paused run. A pending result must be settled before installations.

`PlayerCareer.complete` remains the sole payout authority. Base prize is **$200 completion**, **$350 strong time**, or **$500 time-target win**; these are mutually exclusive tiers. This is a time-trial game, not an invented AI finishing order. Add **$250 first clear**, **$50 improved existing PB** and **$25 clean run** where eligible. A clean first completion gives $475 plus the initial $600, making Engine 1 attainable after one valid finish. Replays of completed rivers continue earning base/clean prizes. Restarting, abandoning, stale/duplicate finish callbacks, incomplete gates and practice do not pay.

| River | Strong time | Time-target victory |
| --- | ---: | ---: |
| River Rush 1 | 90 s | 75 s |
| River Rush 2 | 130 s | 110 s |
| River Rush 3 | 185 s | 160 s |

These are initial central balance values in `src/garage/definitions.js`. Existing first clears stay completed after migration; there are no retroactive bonuses. No nitrous refill is needed to keep racing. Existing empty-fuel reserve and free basic emergency service prevent a service soft lock; emergency service never refills nitrous.

## Actual performance and force integration

The integrator's optional service/performance object now adds engine/pump thrust, a response scale, a nominal drag target and nitrous inlet/drag calibration. The old no-service and `{powerScale:1}` paths retain their original force calculation, covered by existing parity tests. Career stock uses a 93 MPH reference independently of archived debug top-speed values.

Engine stages increase thrust/response and calibrated maximum speed. Pump multipliers are 1.08/1.18/1.30 with modest 1.2%/3%/4% speed benefits. Full engine power is multiplied through the existing waterjet vector; yaw remains thrust/nozzle driven. No rudder, stationary unpowered turning, transmission or velocity multiplication was introduced.

Nitrous adds up to 34% thrust with a short activation ramp. Its maximum-speed influence is separately calibrated through the same resistance curve (7.5% default). This avoids stacking the power and speed settings into an excessive second speed multiplier. Deactivation removes extra thrust immediately; presentation fades separately. Normal pump and hull momentum remain. Tight corners become harder because speed is higher, not because steering is disabled.

[Reproducible measurements](performance-proof.json), generated with `node scripts/verify-career-performance.mjs`, use the actual integrator at 120 Hz, Balanced reference forces, healthy boat, centred nozzle and open straight water without current/banks. Settle for 60 seconds, then apply 20 seconds of sustained injection. This reference script bypasses the tank only to measure the force curve; gameplay consumption is tested separately.

| Engine, stock pump | Target MPH | Measured settled MPH |
| --- | ---: | ---: |
| Stock | 93 | 92.6 |
| Stage 1 | 101 | 100.6 |
| Stage 2 | 109 | 108.5 |
| Stage 3 | 118 | 117.5 |
| Stage 4 | 128 | 127.4 |

Engine 2 + Pump 2 is approximately 112 MPH. Engine 4 + Pump 3 settles around 132.3 MPH; sustained nitrous reaches approximately **143.5 MPH**. Small integration differences from nominal targets are documented, not hidden. Actual course speed varies with turns, current, steering, fuel and hull condition. Higher stages and all pump stages also improve measured launch acceleration.

## Nitrous resource and controls

The installed tank has persistent capacity/current fill, 100 units initially, and consumes **5 units/s** by default: 20 seconds per full tank. It drains only while the kit is installed, charge remains, throttle meets the 80% requirement, a nitrous input is held and race driving is allowed. No idle, drift, trick, waiting, race finish or restart regenerates it. Release/empty/pause/menu/page-hide paths stop boost and save consumption. Fuel and hull maintenance stay separate.

- **Touch:** the same throttle button is now a vertical analog gesture. Slide from its lower end to the top for 0–100% normal throttle. Continue that captured finger 28 px above the full-throttle point into the marked **NITRO** zone. It engages at full normal throttle. Moving back down across the 12 px hysteresis releases nitrous while keeping normal throttle; continue downward to reduce throttle. Releasing/cancelling stops both. Steering remains independent and simultaneous. The upper zone is a non-interactive visual part of the throttle, not another button.
- **Keyboard:** existing W/Up/Space throttle; hold **Left Shift** for nitrous. Shift without throttle cannot boost.
- **Standard Xbox/gamepad:** existing **RT** throttle; hold **RB** (button 5) for nitrous. Release RT/RB and centre the stick to arm after menus/reconnect. Existing A/B/Menu/View navigation and input arbitration remain.

The zone and HUD show kit lock, charge, BOOST and EMPTY. Dedicated gameplay touch-action/gesture guards and pointer capture prevent scroll/zoom interruptions; menus and sliders retain normal interaction. Threshold/hysteresis are development-tunable. The Control Lab displays mappings; device priority, existing curves and analog filtering remain intact.

## V8, camera and spray

Owned engine stages slightly strengthen recorded high-RPM voicing and response without changing saved Audio Lab values. Nitrous adds a restrained RPM/EQ/gain surge using the same recorded layers; there is no replacement synth or second engine controller. The music system/context is unchanged and independently adjustable.

A small eased FOV/orthographic framing effect, faint edge streaks, HUD illumination and up to 20% extra spray density convey boost. Projection changes are restored before the existing camera update and never overwrite an external camera reset. No new course-obscuring blur or shake is used. The water particle direction and ballistics remain unchanged.

## Persistence, units and development boundaries

Canonical key **`jet-sprint-player-profile-v1` stays the same**, now carrying **schema 2** / economy v2. New boat fields are `engineStage`, `pumpStage`, `nitrousInstalled`, `nitrousCapacity`, `nitrousFill`. Cash, lifetime earnings, fuel, condition, boat ID, installed-upgrade metadata, records, unlocked/completed rivers, bounded results and revision/settlement watermarks survive migration. Old v0/v1 profiles gain stock stages and an uninstalled empty tank; no past purchase or payout is invented. The prior valid raw profile is backed up on commit. Future versions remain read-only, quota failures cannot charge/grant unsaved purchases, and observed cross-tab conflicts cannot overwrite newer balances. [Schema 2](../schemas/player-profile-v2.schema.json).

All rendered linear speed values use **MPH**: speedometer, shop/reference stats, Physics/Spray/Camera/maintenance readouts, replay speed/velocity CSV and graphs. Storage and simulation retain their existing SI/km-h data contracts. `speed-units.js` converts range bounds, values and changes at UI boundaries; older settings/JSON/replay snapshots are not blindly reinterpreted. Angular rates, distances and acceleration retain appropriate units.

Career owns `top`, `maxThrust`, `acceleration`, `forwardDrag`, `pumpResponse` and `pumpDecay`. Older saved propulsion values stay stored, but cannot silently bypass bought stages. Steering, drift, banking, camera, audio and other existing preferences remain usable. The old top target is labelled as an archived replay reference; the active stock target is in the new career balance panel.

Open **`?dev=1`** for development practice. HULL → Development / career performance exposes stock MPH, engine speed/power multipliers, pump thrust multipliers, nitrous power/speed influence/consumption, gesture thresholds, throttle requirement and camera intensity. Saved balance lives under **`jet-sprint-upgrade-tuning-v1`** and is ignored by ordinary career. Development permits saved propulsion tuning but earns no prizes or competitive ghost PBs. As with existing practice, owned boat resources still apply; audio-only testing remains resource-free. No free permanent upgrades are granted.

Ghost force classes include acquired engine/pump/kit and effective balance fields. Old ghosts remain viewable; different upgrade configurations cannot overwrite the same competitive ghost class. Replays continue recording actual poses and never resimulate nitrous or charge the career.

## Verification and limits

- `npm test`: **292 passing tests**, including all existing game checks plus transaction costs/limits, profile migration, consumption/inactive/empty behavior, proportional refills, quota failures, debug balance isolation, input hysteresis, RB arming, MPH round trips, ghost classes, staged acceleration/top speeds, thrust-based boost, time-target payouts and camera reset preservation.
- Production build passes; the existing large-bundle advisory remains. The manifest/deployment verifier now requires the upgrade and MPH identities and hashes actual assets.
- [Chromium browser evidence](browser-proof.json): a labelled legacy-profile fixture purchases all stages/kit through the real shop, migrates data, uses native CDP multitouch with one throttle capture and simultaneous steering, tests downward release, keyboard and simulated standard-gamepad input, blocks mid-race purchases/refills, preserves tank/stages/cash on restart/reload, and checks MPH Camera Lab/physics protection. [Shop screenshot](shop-phone.png), [boost screenshot](boost-phone.png).
- [Layout and development checks](layout-proof.json): the 390×844 portrait garage scrolls without horizontal overflow and keeps Return reachable; the speed gauge clears the nitrous zone at 844×390 and 568×320. All 19 development sliders render; a stock-speed edit applies and saves in practice, while a normal reload retains the saved edit but restores the published career balance. [Portrait shop screenshot](shop-portrait.png). Rapid restarts reuse the same four engine loops and two engine/music contexts.
- [Native audio renders](audio-proof.json) exercise Engine Stage 4 and nitrous alongside all six roles at default/max audio settings, compatible WAV fallback and missing files. Output remains finite/below full scale. Physical listening was not performed.
- Physical iPhone Safari, actual Xbox hardware, subjective handling/audio satisfaction and mobile frame rate were **not** verified. Browser touch/gamepad emulation is not a substitute. No full course at every upgrade combination was manually playtested. Reference top speeds are open-water measurements, not guaranteed race speeds.

### Manual iPhone/controller procedure

1. In landscape, open Garage between runs and buy an affordable next stage. Verify the debit/current stage. Install nitrous once; verify the full first tank and disabled repeat purchase/full refill.
2. Start a race. Hold steering with one thumb; place the other near the throttle's lower edge, slide to normal 100%, then continue into NITRO without lifting. Confirm BOOST and falling charge.
3. Slide down into normal full throttle: boost stops immediately, throttle remains 100%. Slide lower, release, alternate steering and repeat rapidly. Confirm no zoom, scrolling, text selection or lost capture.
4. Empty the tank; hold in the zone again. Normal throttle must still work without boost or regeneration. Restart/reload and confirm the tank remains empty. Refill between runs; check the proportional charge and cap.
5. Pause, open labs/garage, background Safari and rotate portrait/landscape. Boost must release. Menus/sliders/Camera Lab zoom must still work. Check safe-area spacing and the upper zone.
6. Test W/Up/Space + Left Shift and RT + RB separately. Release/reconnect/return from a menu and verify neutral arming. Do not combine input devices to bypass device priority.
7. Listen on speakers/headphones for the recorded V8 surge and music balance. Try gentle steering at each stage, lift before tight turns/ramps, and compare pump corner exits. Verify race time/ordered checkpoints and a real payout, then replay for another legitimate reward.

## Files

Core progression: `src/garage/upgrades.js`, `upgrade-tuning.js`, `shop.js`, `career.js`, `profile-model.js`, `profile-store.js`, `definitions.js`, `ui.js`, `garage.css`.

Input/physics/effects: `src/physics.js`, `main.js`, `arcade-touch.js`, `nitrous-gesture.js`, `nitrous-effects.js`, `controls.js`, `control-input.js`, `control-gamepad.js`, `control-lab.js`, `controls.css`, `audio.js`, `engine-rpm.js`.

MPH/replay/UI: `src/speed-units.js`, `settings-panel.js`, `settings.js`, `handling.js`, `physics-lab.js`, `garage/tuning.js`, `racing-camera-lab.js`, `instrument-gauge.js`, `interface.js`, `campaign-ui.js`, `replay/course-data.js`, `replay/session.js`, `replay/feature.js`, `replay/telemetry.js`, `index.html`.

Checks/report: `test/career-upgrades.test.js` and updated control/garage/replay/deployment tests, `scripts/verify-career-performance.mjs`, build/deployment proof scripts, package version files, schema 2, README and this evidence directory. Engine/music assets and course geometry are unchanged.
