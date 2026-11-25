import {
    chapters,
    planes,
    skins,
    pad,
    clamp
} from './data.js';

import { newRun, step } from './sim.js';
import { World, drawHangarPlane } from './world.js';
import { Sound } from './sound.js';
import { Race } from './race.js';
import { icon } from './icons.js';

const $ = id => document.getElementById(id);

document.querySelectorAll('[data-icon]').forEach(element => {
    element.innerHTML = icon(element.dataset.icon);
});

// =====================================
// SAVED PLAYER DATA
// =====================================

const defaultSave = {
    quantum: 0,
    unlocked: 0,
    plane: 0,
    skin: 0,
    planes: [0],
    skins: [0],
    log: [],
    best: {},
    audio: true,
    invert: false,
    controls: 'Joystick'
};

let save;

try {
    save = {
        ...defaultSave,
        ...JSON.parse(
            localStorage.getItem('paperly-flight-v1') || '{}'
        )
    };
} catch {
    save = { ...defaultSave };
}

function persist() {
    try {
        localStorage.setItem(
            'paperly-flight-v1',
            JSON.stringify(save)
        );
    } catch {}
}

// =====================================
// GAME STATE
// =====================================

let selected = clamp(
    save.unlocked,
    0,
    chapters.length - 1
);

let mode = 'story';
let dialogView = '';
let run = null;
let paused = false;
let loading = false;
let worldReady = false;

let model = save.plane;
let swatch = save.skin;

let frame = 0;
let last = 0;
let acc = 0;
let netTimer = 0;
let hudTime = 0;

let previousPose = null;

let peerResult = '';
let raceCode = '';
let raceHelp = '';
let remoteStart = false;

const flightStep = 1 / 60;

const poseFields = [
    'x',
    'y',
    'z',
    'vx',
    'vy',
    'bank',
    'pitch',
    'forwardSpeed',
    'elapsed'
];

const modeNames = {
    story: 'Career',
    free: 'Free Flight',
    endless: 'Endless',
    race: 'Private Race'
};

const world = new World();
const sound = new Sound();

sound.enabled = save.audio;

const keys = new Set();

const touch = {
    x: 0,
    y: 0,
    boost: false
};

const viewportTouch =
    matchMedia('(pointer:coarse)').matches ||
    navigator.maxTouchPoints > 0;

document.body.classList.toggle(
    'coarse',
    viewportTouch
);

// =====================================
// AUDIO
// =====================================

document.addEventListener('click', event => {

    if (!save.audio) return;

    if (
        !sound.ctx ||
        sound.ctx.state === 'suspended'
    ) {
        sound.start();
    }

    const button = event.target.closest?.('button');

    if (
        button &&
        !button.disabled &&
        button.id !== 'audio'
    ) {
        sound.chime('click');
    }

}, true);

function updateAudio() {

    $('audio').innerHTML = icon(
        save.audio ? 'audio' : 'mute'
    );

    $('audio').setAttribute(
        'aria-label',
        save.audio ? 'Mute sound' : 'Enable sound'
    );

    sound.enabled = save.audio;

    const active =
        run &&
        !paused &&
        !run.end;

    sound.wind(
        active ? run.forwardSpeed : 0,
        Boolean(active && run.boosting)
    );
}

function toggleAudio() {

    save.audio = !save.audio;

    if (save.audio) {
        sound.enabled = true;
        sound.start();
    }

    updateAudio();
    persist();
}

$('audio').onclick = toggleAudio;

// =====================================
// MULTIPLAYER
// =====================================

const race = new Race(

    message => {

        raceHelp = message;

        if (dialogView === 'race') {
            showRace();
        }

        if (
            run &&
            mode === 'race' &&
            message.includes('disconnected')
        ) {
            peerResult = message;
            notice(message);
        }
    },

    message => {

        if (
            message?.type === 'start' &&
            !race.host &&
            Number.isInteger(message.chapter) &&
            chapters[message.chapter]
        ) {

            selected = message.chapter;
            mode = 'race';
            remoteStart = true;

            closeDialog();
            renderHome();
            launch();

        } else if (
            message?.type === 'result' &&
            run?.mode === 'race'
        ) {

            peerResult = message.complete

                ? 'Opponent finished in ' +
                  Number(message.elapsed).toFixed(1) +
                  's'

                : 'Opponent landed at ' +
                  Math.floor(Number(message.z) || 0) +
                  ' m';

            if (dialogView === 'result') {
                resultDialog();
            } else {
                notice(peerResult);
            }
        }
    }
);

// =====================================
// DIALOG SYSTEM
// =====================================

function modal(type, label, html) {

    dialogView = type;

    $('dialog-label').textContent = label;
    $('dialog-content').innerHTML = html;

    if (!$('dialog').open) {
        $('dialog').showModal();
    }

    $('dialog').scrollTop = 0;

    document.querySelectorAll('.nav').forEach(nav => {

        const active = type === 'hangar'
            ? 'hangar'
            : type === 'log'
                ? 'log'
                : 'chapters';

        nav.classList.toggle(
            'on',
            nav.id === 'nav-' + active
        );
    });
}

function closeDialog() {

    if ($('dialog').open) {
        $('dialog').close();
    }

    dialogView = '';

    document.querySelectorAll('.nav').forEach(nav => {
        nav.classList.toggle(
            'on',
            nav.id === 'nav-chapters'
        );
    });
}

function dismiss() {

    if (dialogView === 'pause') {
        resume();
        return;
    }

    if (dialogView === 'result') {
        toMenu();
        return;
    }

    if (loading) return;

    closeDialog();
}

$('close').onclick = dismiss;

$('dialog').addEventListener('cancel', event => {
    event.preventDefault();
    dismiss();
});

$('dialog').addEventListener('click', event => {

    if (event.target !== $('dialog')) return;

    const bounds = $('dialog').getBoundingClientRect();

    if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
    ) {
        dismiss();
    }
});

// =====================================
// AIRCRAFT SKINS
// =====================================

function skinFilter(index) {

    const filters = [
        '',
        'sepia(.65) saturate(2)',
        'sepia(.45) saturate(2.7) hue-rotate(283deg)',
        'sepia(.45) saturate(2) hue-rotate(101deg)',
        'sepia(.42) saturate(2.3) hue-rotate(214deg)',
        'sepia(.55) saturate(2.2) hue-rotate(160deg)',
        'sepia(.65) saturate(3) hue-rotate(326deg)'
    ];

    return filters[index] || '';
}

// =====================================
// CHAPTER SELECT
// =====================================

function cardMarkup(chapter) {

    const locked =
        mode === 'story' &&
        chapter.id > save.unlocked;

    const active = chapter.id === selected;
    const complete = Boolean(save.best[chapter.id]);

    const status = locked
        ? 'Locked'
        : complete
            ? 'Completed'
            : 'Available';

    const cardIcon = locked
        ? 'lock'
        : active
            ? 'check'
            : complete
                ? 'flag'
                : 'compass';

    return `
        <button
            class="card ${active ? 'selected' : ''}"
            data-card="${chapter.id}"
            aria-label="${chapter.name}, ${status}"
            aria-pressed="${active}"
            style="background-image:url(art/${chapter.slug}.webp)"
        >
            <span class="card-top">

                <span>CH. ${pad(chapter.id + 1)}</span>

                <i>${icon(cardIcon, 13)}</i>

            </span>

            <span class="card-bottom">

                <strong class="card-name">
                    ${chapter.name}
                </strong>

                <span class="card-meta">
                    ${status}
                </span>

            </span>

        </button>
    `;
}

function renderHome() {

    const chapter = chapters[selected];

    const locked =
        mode === 'story' &&
        selected > save.unlocked;

    $('chapter-title').textContent = chapter.name;

    $('chapter-label').textContent =
        'CHAPTER ' + pad(selected + 1);

    $('mode-label').textContent =
        modeNames[mode].toUpperCase();

    const modeIcon =
        mode === 'free' || mode === 'endless'
            ? 'infinity'
            : mode === 'race'
                ? 'flag'
                : 'compass';

    $('mode').innerHTML =
        icon(modeIcon, 15) +
        modeNames[mode] +
        icon('down', 14);

    $('description').textContent =
        chapter.description;

    $('scene').style.backgroundImage =
        `url(art/${chapter.slug}.webp)`;

    $('hero-plane').src =
        save.plane === 0
            ? 'art/hero-plane.webp'
            : `art/plane-${save.plane}.webp`;

    $('hero-plane').style.filter =
        skinFilter(save.skin);

    $('plane-caption').textContent =
        planes[save.plane].name.toUpperCase();

    $('launch').disabled = locked;

    $('launch').innerHTML =
        icon(locked ? 'lock' : 'play', 15) +

        (
            locked
                ? 'Chapter locked'
                : mode === 'race'
                    ? 'Race lobby'
                    : 'Launch flight'
        ) +

        (
            locked
                ? ''
                : '<span class="kbd-space">SPACE</span>'
        );

    $('launch').title = locked
        ? 'Complete ' + chapters[selected - 1].name + ' to unlock'
        : '';

    $('balance').textContent = save.quantum;

    $('position').innerHTML =
        pad(selected + 1) +
        ' <em>/ ' + chapters.length + '</em>';

    $('cards').innerHTML =
        chapters.map(cardMarkup).join('');

    updateAudio();

    requestAnimationFrame(updateRail);
}

function selectChapter(index) {

    selected = index;

    renderHome();

    const rail = $('cards');

    const card = rail.children[index];

    const left =
        card.offsetLeft - rail.offsetLeft;

    if (
        left < rail.scrollLeft ||
        left + card.offsetWidth >
            rail.scrollLeft + rail.clientWidth
    ) {
        rail.scrollTo({
            left,
            behavior: 'smooth'
        });
    }
}

function updateRail() {

    const rail = $('cards');

    $('prev').disabled = rail.scrollLeft < 3;

    $('next').disabled =
        rail.scrollLeft + rail.clientWidth >=
        rail.scrollWidth - 4;
}

$('cards').onclick = event => {

    const button = event.target.closest('[data-card]');

    if (button) {
        selectChapter(Number(button.dataset.card));
    }
};

$('cards').onscroll = updateRail;

window.addEventListener('resize', updateRail);

for (const [id, sign] of [
    ['prev', -1],
    ['next', 1]
]) {

    $(id).onclick = () => {

        const rail = $('cards');

        const width = rail.children[0].offsetWidth;

        const gap =
            parseFloat(getComputedStyle(rail).gap) || 14;

        const count = Math.max(
            1,
            Math.floor(rail.clientWidth / (width + gap)) - 1
        );

        rail.scrollBy({
            left: sign * (width + gap) * count,
            behavior: 'smooth'
        });
    };
}

$('nav-chapters').onclick = () => {
    closeDialog();
    renderHome();
};

$('home').onclick = () => {
    closeDialog();
    selectChapter(0);
};

// =====================================
// GAME MODES
// =====================================

function modes() {

    const options = [

        [
            'story',
            'Career',
            'Complete chapters and unlock new landscapes.'
        ],

        [
            'free',
            'Free Flight',
            'Explore every landscape without a time limit.'
        ],

        [
            'endless',
            'Endless',
            'Collect time and fly as far as possible.'
        ],

        [
            'race',
            'Private Race',
            'Compete against another pilot.'
        ]
    ];

    modal(
        'modes',
        'FLIGHT MODES',

        '<h2>Choose a mode</h2>' +

        options.map(([id, name, description]) => `

            <button
                class="select-mode ${mode === id ? 'active' : ''}"
                data-mode="${id}"
            >

                <span>
                    <strong>${name}</strong>
                    <small>${description}</small>
                </span>

                ${icon(mode === id ? 'check' : 'right')}

            </button>

        `).join('')
    );

    $('dialog-content').onclick = event => {

        const button = event.target.closest('[data-mode]');

        if (!button) return;

        mode = button.dataset.mode;

        closeDialog();
        renderHome();

        if (mode === 'race') {
            showRace();
        }
    };
}

$('mode').onclick = modes;

// =====================================
// 3D AIRCRAFT HANGAR
// =====================================

function hangar(message = '') {

    const plane = planes[model];

    const ownsPlane = save.planes.includes(model);
    const ownsSkin = save.skins.includes(swatch);

    const cost =
        (ownsPlane ? 0 : plane.cost) +
        (ownsSkin ? 0 : skins[swatch][2]);

    const alreadyEquipped =
        save.plane === model &&
        save.skin === swatch;

    let equipText;

    if (alreadyEquipped) {

        equipText = 'Equipped';

    } else if (cost > save.quantum) {

        equipText =
            'Collect ' +
            (cost - save.quantum) +
            ' more Quantum';

    } else if (cost > 0) {

        equipText =
            'Unlock & equip · ' +
            cost +
            ' Quantum';

    } else {

        equipText = 'Equip plane';
    }

    const stats = [

        ['Velocity', plane.speed],
        ['Lift', plane.lift],
        ['Steering', plane.steering]

    ].map(([label, value]) => `

        <div>

            <label>${label}</label>

            <div class="line">

                <b style="width:${value / 7 * 100}%"></b>

            </div>

        </div>

    `).join('');

    const skinButtons = skins.map(([name, color], index) => `

        <button
            class="swatch ${index === swatch ? 'active' : ''}"
            data-skin="${index}"
            title="${name}"
            aria-label="${name} skin"
            style="background:#${color.toString(16).padStart(6, '0')}"
        >
            ${save.skins.includes(index) ? '' : icon('lock', 12)}
        </button>

    `).join('');

    modal(
        'hangar',
        'AIRCRAFT COLLECTION',

        `
        <h2>Hangar</h2>

        <div class="plane-show">

            <button
                class="round"
                id="plane-prev"
                aria-label="Previous plane"
            >
                ${icon('left')}
            </button>

            <canvas
                id="hangar-aircraft"
                width="420"
                height="220"
                aria-label="${plane.name} aircraft preview"
                style="
                    display:block;
                    width:min(65%,320px);
                    height:100%;
                    min-width:0;
                    object-fit:contain;
                "
            ></canvas>

            <button
                class="round"
                id="plane-next"
                aria-label="Next plane"
            >
                ${icon('right')}
            </button>

        </div>

        <div class="hang-controls">

            <h3>${plane.name}</h3>

            <span class="hang-quantity">
                ${pad(model + 1)} / ${planes.length}
            </span>

        </div>

        <div class="stats">
            ${stats}
        </div>

        <h3>
            Skin · ${skins[swatch][0]}
        </h3>

        <div class="swatches">

            ${skinButtons}

        </div>

        <p class="panel-msg">

            ${
                message ||
                (
                    cost
                        ? 'Cost · ' + cost +
                          ' Quantum / Balance · ' +
                          save.quantum + ' Quantum'
                        : ''
                )
            }

        </p>

        <button
            id="equip"
            class="primary wide"
            ${
                alreadyEquipped || cost > save.quantum
                    ? 'disabled'
                    : ''
            }
        >
            ${equipText}
        </button>
        `
    );

    // Render the same 3D geometry used during gameplay.

    drawHangarPlane(
        $('hangar-aircraft'),
        model,
        swatch
    );

    $('plane-prev').onclick = () => {

        model =
            (model + planes.length - 1) %
            planes.length;

        hangar();
    };

    $('plane-next').onclick = () => {

        model =
            (model + 1) %
            planes.length;

        hangar();
    };

    document.querySelector('.swatches').onclick = event => {

        const button = event.target.closest('[data-skin]');

        if (!button) return;

        swatch = Number(button.dataset.skin);

        hangar();
    };

    $('equip').onclick = () => {

        if (
            cost > save.quantum ||
            alreadyEquipped
        ) return;

        save.quantum -= cost;

        if (!ownsPlane) {
            save.planes.push(model);
        }

        if (!ownsSkin) {
            save.skins.push(swatch);
        }

        save.plane = model;
        save.skin = swatch;

        persist();

        renderHome();

        sound.chime('gem');

        hangar('Aircraft equipped');
    };
}

$('nav-hangar').onclick = () => {

    model = save.plane;
    swatch = save.skin;

    hangar();
};

// =====================================
// HELP
// =====================================

function showHelp() {

    modal(
        'help',
        'FLIGHT MANUAL',

        `
        <h2>How to fly</h2>

        <p>
            Dive to gain momentum. Climb to gain altitude.
            Sharp turns reduce lift and can cause altitude loss.
        </p>

        <div class="help-row">

            <b>Climb / dive</b>

            <span>
                <kbd>W</kbd>
                <kbd>S</kbd>
                or
                <kbd>↑</kbd>
                <kbd>↓</kbd>
            </span>

        </div>

        <div class="help-row">

            <b>Bank left / right</b>

            <span>
                <kbd>A</kbd>
                <kbd>D</kbd>
                or
                <kbd>←</kbd>
                <kbd>→</kbd>
            </span>

        </div>

        <div class="help-row">

            <b>Wind boost / pause</b>

            <span>
                <kbd>SHIFT</kbd>
                /
                <kbd>ESC</kbd>
            </span>

        </div>

        <h3>Career</h3>

        <p>
            Fly through every gold checkpoint.
            Each checkpoint gives additional time.
            Missing one prevents a chapter clear.
            Fly through the final lime ring to finish.
        </p>

        <h3>Free Flight</h3>

        <p>
            Explore all landscapes without a countdown.
            Avoid obstacles and collect Quantum.
        </p>

        <h3>Endless</h3>

        <p>
            Collect time extensions and fly as far as possible.
        </p>

        <button id="got-it" class="primary wide">
            Got it
        </button>
        `
    );

    $('got-it').onclick = closeDialog;
}

$('how').onclick = showHelp;

// =====================================
// SETTINGS
// =====================================

function settings() {

    modal(
        'settings',
        'PREFERENCES',

        `
        <h2>Settings</h2>

        <label class="setting">

            Sound effects & music

            <input
                id="sound-check"
                type="checkbox"
                ${save.audio ? 'checked' : ''}
            >

        </label>

        <label class="setting">

            Invert vertical controls

            <input
                id="invert"
                type="checkbox"
                ${save.invert ? 'checked' : ''}
            >

        </label>

        <label class="setting">

            Touch controls

            <select id="control">

                <option>Joystick</option>
                <option>Buttons</option>

            </select>

        </label>
        `
    );

    $('control').value = save.controls;

    $('sound-check').onchange = toggleAudio;

    $('invert').onchange = event => {
        save.invert = event.target.checked;
        persist();
    };

    $('control').onchange = event => {

        save.controls = event.target.value;

        persist();
        touchLayout();
    };
}

$('settings').onclick = settings;

// =====================================
// RECORDS AND ACHIEVEMENTS
// =====================================

function records() {

    const wins = Object.entries(save.best)
        .sort(([a], [b]) => Number(a) - Number(b));

    const goals = [

        [
            'First flight',
            'Clear the first chapter',
            Boolean(save.best[0])
        ],

        [
            'World traveller',
            'Clear every Career chapter',
            wins.length === chapters.length
        ],

        [
            'Aircraft collector',
            'Own every aircraft',
            save.planes.length === planes.length
        ],

        [
            'Colour collection',
            'Own every skin',
            save.skins.length === skins.length
        ]
    ];

    modal(
        'records',
        'PILOT RECORD',

        `
        <h2>Records & achievements</h2>

        <h3>Personal bests</h3>

        ${
            wins.length

                ? wins.map(([id, time]) => `

                    <div class="log-entry">

                        <b>${chapters[id].name}</b>

                        <span>${time.toFixed(1)} s</span>

                    </div>

                `).join('')

                : '<p>Finish a chapter to set your first time.</p>'
        }

        <h3>Achievements</h3>

        ${goals.map(([name, description, unlocked]) => `

            <div class="log-entry">

                <span>

                    <b>${name}</b>

                    <br>

                    <small>${description}</small>

                </span>

                ${icon(unlocked ? 'trophy' : 'lock', 18)}

            </div>

        `).join('')}

        <button class="secondary wide" id="back-log">
            Back to flight log
        </button>
        `
    );

    $('back-log').onclick = log;
}

function log() {

    const rows = save.log.slice(0, 30);

    modal(
        'log',
        'PILOT RECORD',

        `
        <h2>Flight log</h2>

        <div class="result-grid">

            <div>
                <small>Chapters cleared</small>
                <b>${Object.keys(save.best).length} / ${chapters.length}</b>
            </div>

            <div>
                <small>Planes owned</small>
                <b>${save.planes.length} / ${planes.length}</b>
            </div>

            <div>
                <small>Quantum</small>
                <b>${save.quantum}</b>
            </div>

        </div>

        <h3>Recent flights</h3>

        ${
            rows.length

                ? '<div class="log-list">' +

                    rows.map(row => `

                        <div class="log-entry">

                            <span>

                                <b>${chapters[row.id].name}</b>

                                <br>

                                <small>
                                    ${modeNames[row.mode] || row.mode}
                                    · ${row.reason}
                                </small>

                            </span>

                            <span>
                                ${row.distance} m · ${row.time}s
                            </span>

                        </div>

                    `).join('') +

                    '</div>'

                : '<p>Launch your first flight to record your progress.</p>'
        }

        <p class="local-note">
            Progress is saved in this browser.
        </p>

        <button id="records" class="secondary wide">
            Records & achievements
        </button>
        `
    );

    $('records').onclick = records;
}

$('nav-log').onclick = log;

// =====================================
// PRIVATE RACE LOBBY
// =====================================

function showRace() {

    const connected = race.connected;

    modal(
        'race',
        'MULTIPLAYER',

        `
        <h2>Private Race</h2>

        <p>
            Two pilots fly the same chapter.
            The host chooses the route.
        </p>

        <p class="peer-status" id="race-status"></p>

        ${
            connected

                ? `
                  <button
                      class="primary wide"
                      id="race-launch"
                      ${race.host ? '' : 'disabled'}
                  >
                      ${race.host ? 'Launch race' : 'Waiting for host'}
                  </button>
                  `

                : `
                  <div class="dialog-actions">

                      <button class="action" id="create-race">
                          Create invitation
                      </button>

                      <button class="action" id="join-race">
                          Answer invitation
                      </button>

                  </div>

                  <h3>Connection code</h3>

                  <textarea
                      class="race-code"
                      id="race-input"
                      rows="3"
                      aria-label="Connection code"
                      placeholder="Paste the other pilot's code here"
                  ></textarea>

                  <div class="dialog-actions">

                      <button class="action" id="copy-race">
                          Copy my code
                      </button>

                      <button class="action" id="accept-race">
                          Connect with answer
                      </button>

                  </div>

                  <p class="local-note">
                      Create an invitation and exchange connection codes
                      with the other pilot.
                  </p>
                  `
        }

        <p class="local-note">
            Course · ${chapters[selected].name}
        </p>
        `
    );

    $('race-status').textContent = raceHelp;

    if (connected) {

        $('race-launch').onclick = () => launch();

        return;
    }

    $('race-input').value = raceCode;

    async function perform(work) {

        try {

            $('race-status').textContent =
                'Preparing connection…';

            await work();

        } catch {

            raceHelp =
                'Could not connect. Check the invitation code.';
        }

        if (dialogView === 'race') {
            showRace();
        }
    }

    $('create-race').onclick = () => perform(async () => {

        raceCode = await race.invite();

        raceHelp =
            'Invitation ready to copy and share.';
    });

    $('join-race').onclick = () => {

        const code = $('race-input').value;

        perform(async () => {

            raceCode = await race.join(code);

            raceHelp =
                'Answer ready to copy and send to the host.';
        });
    };

    $('accept-race').onclick = () => {

        const code = $('race-input').value;

        perform(async () => {

            await race.accept(code);

            raceHelp = race.connected
                ? 'Connected'
                : 'Connecting to the other pilot…';
        });
    };

    $('copy-race').onclick = async () => {

        if (!raceCode) {

            $('race-status').textContent =
                'Create or answer an invitation first.';

            return;
        }

        try {

            await navigator.clipboard.writeText(raceCode);

            $('race-status').textContent = 'Code copied.';

        } catch {

            $('race-input').value = raceCode;
            $('race-input').select();

            $('race-status').textContent =
                'Code selected for copying.';
        }
    };
}

// =====================================
// GAME CONTROLS
// =====================================

function touchLayout() {

    $('stick').hidden =
        save.controls !== 'Joystick';

    $('arrows').hidden =
        save.controls !== 'Buttons';
}

function clearInputs() {

    keys.clear();

    touch.x = 0;
    touch.y = 0;
    touch.boost = false;

    $('stick').firstElementChild.style.transform = '';
}

function controls() {

    function direction(positive, negative) {

        return Number(
            positive.some(key => keys.has(key))
        ) -

        Number(
            negative.some(key => keys.has(key))
        );
    }

    const x = direction(
        ['KeyD', 'ArrowRight'],
        ['KeyA', 'ArrowLeft']
    ) + touch.x;

    const y = direction(
        ['KeyW', 'ArrowUp'],
        ['KeyS', 'ArrowDown']
    ) + touch.y;

    return {
        x: clamp(x, -1, 1),

        y: clamp(y, -1, 1) *
            (save.invert ? -1 : 1),

        boost:
            keys.has('ShiftLeft') ||
            keys.has('ShiftRight') ||
            touch.boost
    };
}

// =====================================
// HUD
// =====================================

function notice(message) {

    if (!run) return;

    run.notice = message;
    run.noticeUntil = run.elapsed + 2;
}

function refreshHud() {

    const freeFlight = run.mode === 'free';

    const unlimitedCourse =
        freeFlight ||
        run.mode === 'endless';

    const progress = unlimitedCourse

        ? (run.z % 1000) / 10

        : Math.min(
            run.end === 'complete' ? 100 : 99,
            run.z / run.chapter.length * 100
        );

    $('progress').style.width = progress + '%';

    $('hud-time').innerHTML =

        icon('timer', 15) +

        (
            freeFlight
                ? '∞'
                : Math.max(0, Math.ceil(run.time)) + 's'
        );

    $('hud-time').classList.toggle(
        'urgent',
        !freeFlight && run.time < 4
    );

    $('hud-rings').hidden =
        !run.requiredRings;

    $('hud-rings').textContent =
        run.rings +
        '/' +
        run.requiredRings +
        ' rings';

    $('hud-rings').classList.toggle(
        'urgent',

        run.requiredRings > 0 &&
        run.rings < run.cursor
    );

    $('hud-quantum').innerHTML =
        icon('gem', 15) + run.quantum;

    $('boost-fill').style.width =
        run.energy + '%';

    $('speed').textContent =
        Math.round(run.forwardSpeed * 3.6);

    $('flight-notice').textContent =

        run.alignFinish && !run.end

            ? 'Steer through the finish ring'

            : run.elapsed < run.noticeUntil

                ? run.notice

                : '';
}

// =====================================
// FIXED-STEP GAME LOOP
// =====================================

function tick(now) {

    if (!run || paused || run.end) {
        return;
    }

    const dt = Math.min(
        0.35,
        Math.max(0, (now - last) / 1000)
    );

    last = now;
    acc += dt;

    const input = controls();

    // Physics runs at a stable 60 updates per second.

    while (acc >= flightStep && !run.end) {

        previousPose = { ...run };

        step(
            run,
            input,
            flightStep,
            event => sound.chime(event)
        );

        acc -= flightStep;
    }

    // Interpolate rendering to keep movement smooth.

    const pose = { ...run };

    if (previousPose && !run.end) {

        const blend = acc / flightStep;

        for (const field of poseFields) {

            pose[field] =
                previousPose[field] +

                (run[field] - previousPose[field]) *
                blend;
        }
    }

    // Render the actual 3D aircraft.

    world.draw(
        pose,
        save.skin,

        mode === 'race'
            ? race.remote
            : null
    );

    hudTime += dt;

    if (hudTime > 0.10 || run.end) {

        refreshHud();

        sound.wind(
            run.forwardSpeed,
            run.boosting
        );

        hudTime = 0;
    }

    if (
        mode === 'race' &&
        (netTimer += dt) > 0.09
    ) {

        race.send({
            type: 'pos',
            x: run.x,
            y: run.y,
            z: run.z
        });

        netTimer = 0;
    }

    if (run.end) {

        finish();

        return;
    }

    frame = requestAnimationFrame(tick);
}

// =====================================
// LAUNCH FLIGHT
// =====================================

async function launch() {

    if (loading) return;

    if (
        mode === 'story' &&
        selected > save.unlocked
    ) return;

    if (
        mode === 'race' &&

        (
            !race.connected ||
            (!race.host && !remoteStart)
        )
    ) {

        showRace();

        return;
    }

    loading = true;

    closeDialog();
    clearInputs();

    sound.start();

    $('home-screen').inert = true;

    document.querySelector('header').inert = true;

    document.body.classList.add('in-flight');

    const chapter = chapters[selected];

    $('flight').hidden = false;

    $('world').style.backgroundImage =
        `url(art/${chapter.slug}.webp)`;

    try {

        if (!worldReady) {

            await world.init($('world'));

            worldReady = true;
        }

        world.app.resize();

        // Use the aircraft equipped in the hangar.

        run = newRun(
            chapter,
            planes[save.plane],
            mode
        );

        // Free Flight is unlimited.

        if (mode === 'free') {

            run.time = Infinity;
            run.requiredRings = 0;
        }

        previousPose = null;

        paused = false;

        acc = 0;
        netTimer = 0;
        hudTime = 0;

        peerResult = '';

        race.remote = null;

        if (mode === 'race' && race.host) {

            race.send({
                type: 'start',
                chapter: selected
            });
        }

        remoteStart = false;

        $('hud-name').textContent =
            chapter.name;

        $('hud-plane').textContent =
            run.plane.name;

        touchLayout();

        notice(

            mode === 'free'
                ? 'Explore freely'

                : mode === 'endless'
                    ? 'Collect time to keep flying'

                    : 'Follow every gold checkpoint'
        );

        refreshHud();

        world.draw(
            run,
            save.skin,
            null
        );

        last = performance.now();

        cancelAnimationFrame(frame);

        frame = requestAnimationFrame(tick);

    } catch (error) {

        console.error('Flight initialization failed:', error);

        run = null;

        $('home-screen').inert = false;

        document.querySelector('header').inert = false;

        document.body.classList.remove('in-flight');

        $('flight').hidden = true;

        sound.wind(0);

        modal(
            'error',
            'FLIGHT SYSTEM',

            '<h2>Unable to launch flight</h2>' +
            '<p>Check the browser console for the error.</p>'
        );

    } finally {

        loading = false;
    }
}

$('launch').onclick = () => {

    if (mode === 'race') {

        showRace();

    } else {

        launch();
    }
};

// =====================================
// COMPLETE FLIGHT
// =====================================

function finish() {

    const won = run.end === 'complete';

    const chapter = run.chapter;

    if (won && run.mode === 'story') {

        save.unlocked = Math.max(

            save.unlocked,

            Math.min(
                chapter.id + 1,
                chapters.length - 1
            )
        );

        save.best[chapter.id] = Math.min(

            save.best[chapter.id] || Infinity,

            run.elapsed
        );
    }

    const earned =
        run.quantum + (won ? 10 : 0);

    save.quantum += earned;

    save.log.unshift({

        id: chapter.id,

        mode: run.mode,

        distance: Math.round(run.z),

        time: Number(run.elapsed.toFixed(1)),

        reason: won
            ? 'Completed'
            : run.end,

        quantum: earned
    });

    save.log = save.log.slice(0, 100);

    persist();

    sound.wind(0);

    if (won) {

        sound.chime('complete');

    } else if (/contact|Ice ceiling/.test(run.end)) {

        sound.chime('crash');

    } else {

        sound.chime('fail');
    }

    clearInputs();

    if (mode === 'race') {

        race.send({

            type: 'result',

            complete: won,

            elapsed: run.elapsed,

            z: run.z
        });
    }

    resultDialog();
}

// =====================================
// FLIGHT RESULT
// =====================================

function resultDialog() {

    const won = run.end === 'complete';

    const chapter = run.chapter;

    const next =
        won &&
        mode === 'story' &&
        chapter.id < chapters.length - 1;

    const title = won

        ? 'Chapter cleared'

        : run.time <= 0

            ? 'Time’s up'

            : 'Flight ended';

    modal(

        'result',

        'FLIGHT REPORT',

        `
        <h2>${title}</h2>

        <p>
            ${chapter.name}
            ·
            ${won ? 'Finish reached' : run.end}
        </p>

        <div class="result-grid">

            <div>

                <small>Distance</small>

                <b>${Math.round(run.z)} m</b>

            </div>

            <div>

                <small>Flight time</small>

                <b>${run.elapsed.toFixed(1)} s</b>

            </div>

            <div>

                <small>Quantum earned</small>

                <b>+${run.quantum + (won ? 10 : 0)}</b>

            </div>

        </div>

        <p>

            ${run.rings}

            ${
                run.requiredRings
                    ? '/' + run.requiredRings
                    : ''
            }

            rings cleared

            ·

            ${run.bonusTime} bonus seconds

        </p>

        ${
            next

                ? '<p class="mini">UNLOCKED · ' +
                  chapters[chapter.id + 1].name.toUpperCase() +
                  '</p>'

                : ''
        }

        ${
            peerResult

                ? '<p class="peer-status">' +
                  peerResult +
                  '</p>'

                : ''
        }

        <div class="dialog-actions">

            <button
                id="results-home"
                class="secondary"
            >
                Chapter select
            </button>

            <button
                id="again"
                class="primary"
            >
                ${
                    next
                        ? 'Next chapter'

                        : mode === 'race'
                            ? 'Race lobby'

                            : 'Fly again'
                }
            </button>

        </div>
        `
    );

    $('results-home').onclick = () => {

        toMenu();
    };

    $('again').onclick = () => {

        if (next) {

            selected = chapter.id + 1;
        }

        toMenu(false);

        if (mode === 'race') {

            showRace();

        } else {

            launch();
        }
    };
}

// =====================================
// RETURN TO MENU
// =====================================

function toMenu(advance = true) {

    cancelAnimationFrame(frame);

    if (

        advance &&

        run?.end === 'complete' &&

        mode === 'story'

    ) {

        selected = Math.min(
            run.chapter.id + 1,
            chapters.length - 1
        );
    }

    run = null;

    paused = false;

    $('home-screen').inert = false;

    document.querySelector('header').inert = false;

    document.body.classList.remove('in-flight');

    clearInputs();

    sound.wind(0);

    $('flight').hidden = true;

    closeDialog();

    selectChapter(selected);
}

// =====================================
// PAUSE AND RESUME
// =====================================

function pause() {

    if (!run || run.end || paused) return;

    if (mode === 'race') {

        clearInputs();

        modal(

            'live-race',

            'MULTIPLAYER',

            `
            <h2>Live race</h2>

            <p>The race continues for both pilots.</p>

            <div class="dialog-actions">

                <button id="quit-race" class="secondary">

                    Leave race

                </button>

                <button id="keep-flying" class="primary">

                    Keep flying

                </button>

            </div>
            `
        );

        $('quit-race').onclick = () => {

            run.end = 'Flight abandoned';

            finish();
            toMenu();
        };

        $('keep-flying').onclick = closeDialog;

        return;
    }

    paused = true;

    cancelAnimationFrame(frame);

    clearInputs();

    sound.wind(0);

    modal(

        'pause',

        'IN FLIGHT',

        `
        <h2>Flight paused</h2>

        <p>
            ${run.chapter.name}
            ·
            ${Math.floor(run.z)} m flown
        </p>

        <div class="dialog-actions">

            <button id="return-menu" class="secondary">

                Leave flight

            </button>

            <button id="resume" class="primary">

                ${icon('play', 15)}

                Resume

            </button>

        </div>
        `
    );

    $('return-menu').onclick = () => {

        run.end = 'Flight abandoned';

        finish();

        toMenu();
    };

    $('resume').onclick = resume;
}

function resume() {

    if (!run || !paused) return;

    closeDialog();

    paused = false;

    last = performance.now();

    acc = 0;

    previousPose = null;

    frame = requestAnimationFrame(tick);
}

$('pause').onclick = pause;

// =====================================
// KEYBOARD CONTROLS
// =====================================

window.addEventListener('keydown', event => {

    if (event.target.matches('input,select,textarea')) return;

    if (event.code === 'Escape') {

        if ($('dialog').open) return;

        if (run) {

            event.preventDefault();

            pause();
        }

        return;
    }

    if ($('dialog').open) return;

    if (!run) {

        if (

            event.code === 'Space' &&

            !event.repeat &&

            (
                event.target === document.body ||

                event.target === $('launch')
            )

        ) {

            event.preventDefault();

            $('launch').click();
        }

        return;
    }

    const validKeys = [

        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',

        'Space',

        'ShiftLeft',
        'ShiftRight',

        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD'
    ];

    if (validKeys.includes(event.code)) {

        event.preventDefault();

        keys.add(event.code);
    }
});

window.addEventListener('keyup', event => {

    keys.delete(event.code);
});

window.addEventListener('blur', () => {

    clearInputs();

    if (run && !run.end && mode !== 'race') {

        pause();
    }
});

document.addEventListener('visibilitychange', () => {

    if (document.hidden && run && !run.end) {

        clearInputs();

        if (mode !== 'race') {

            pause();
        }
    }
});

// =====================================
// MOBILE JOYSTICK
// =====================================

const stick = $('stick');

let stickPointer = -1;

function steer(event) {

    const bounds = stick.getBoundingClientRect();

    const dx =
        event.clientX -
        bounds.left -
        bounds.width / 2;

    const dy =
        event.clientY -
        bounds.top -
        bounds.height / 2;

    const length = Math.max(
        27,
        Math.hypot(dx, dy)
    );

    touch.x = dx / length;
    touch.y = -dy / length;

    stick.firstElementChild.style.transform =
        `translate(${touch.x * 24}px, ${-touch.y * 24}px)`;
}

stick.onpointerdown = event => {

    stickPointer = event.pointerId;

    stick.setPointerCapture(event.pointerId);

    steer(event);
};

stick.onpointermove = event => {

    if (stickPointer === event.pointerId) {

        steer(event);
    }
};

stick.onlostpointercapture = () => {

    stickPointer = -1;

    touch.x = 0;
    touch.y = 0;

    stick.firstElementChild.style.transform = '';
};

// =====================================
// MOBILE ARROW BUTTONS
// =====================================

const directions = {

    up: 'ArrowUp',

    down: 'ArrowDown',

    left: 'ArrowLeft',

    right: 'ArrowRight'
};

document.querySelectorAll('[data-dir]').forEach(button => {

    button.onpointerdown = event => {

        button.setPointerCapture(event.pointerId);

        keys.add(directions[button.dataset.dir]);
    };

    button.onlostpointercapture = () => {

        keys.delete(directions[button.dataset.dir]);
    };
});

$('touchboost').onpointerdown = event => {

    $('touchboost').setPointerCapture(event.pointerId);

    touch.boost = true;
};

$('touchboost').onlostpointercapture = () => {

    touch.boost = false;
};

// =====================================
// INITIALIZE GAME
// =====================================

touchLayout();

renderHome();