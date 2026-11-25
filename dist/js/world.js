import {
    clamp,
    groundY,
    gate,
    finishGate,
    obstacles
} from './data.js';

import {
    drawAircraft,
    drawHangarPlane
} from './aircraft3d.js';

export { drawHangarPlane };

const blend = (a, b, t) => {
    const mix = s => Math.round(
        ((a >> s) & 255) * (1 - t) +
        ((b >> s) & 255) * t
    );

    return (mix(16) << 16) |
           (mix(8) << 8) |
           mix(0);
};

export class World {

    async init(host) {

        const app = new PIXI.Application();

        let gpu = false;

        try {
            gpu = PIXI.isWebGLSupported();
        } catch {}

        this.showStreaks = !matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        await app.init({
            resizeTo: host,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: Math.min(devicePixelRatio || 1, 1.5),
            preference: gpu ? 'webgl' : 'canvas',
            autoStart: false
        });

        this.app = app;
        this.g = new PIXI.Graphics();

        app.stage.addChild(this.g);
        host.appendChild(app.canvas);
    }

    draw(s, skin, peer) {

        const g = this.g;

        const {
            width: w,
            height: h
        } = this.app.screen;

        const c = s.chapter;

        const focus = Math.min(w * 0.82, h * 1.06);

        const cx = w * 0.5;
        const cy = h * 0.42 + s.pitch * h * 0.026;

        const camera = {
            x: s.x - s.vx * 0.13,
            y: s.y + 4 - s.vy * 0.10,
            z: s.z - 18
        };

        // Perspective projection

        function project(x, y, z) {
            const distance = Math.max(1.8, z - camera.z);

            return [
                cx + (x - camera.x) * focus / distance,
                cy - (y - camera.y) * focus / distance
            ];
        }

        function tri(a, b, d, color) {
            g.poly([...a, ...b, ...d]).fill(color);
        }

        function line(points, color, width, alpha = 1) {

            g.moveTo(...points[0]);

            for (const point of points.slice(1)) {
                g.lineTo(...point);
            }

            g.stroke({
                color,
                width,
                alpha
            });
        }

        g.clear();

        // =====================================
        // TERRAIN
        // =====================================

        const depth = 36;
        const span = 32;

        const rowFloor = Math.floor(camera.z / depth);
        const column = Math.round(camera.x / span);

        function vertex(col, row) {

            const sx = col * span +
                6 * Math.sin(col * 4.3 + row * 9.1);

            const sz = row * depth;

            return project(
                sx,
                groundY(c, sx, sz),
                sz
            );
        }

        // =====================================
        // OBSTACLES
        // =====================================

        function prop(o) {

            const base = groundY(c, o.x, o.z);

            const [x, y] = project(
                o.x,
                base,
                o.z
            );

            const scale = focus / (o.z - camera.z);

            if (scale <= 0 || x < -220 || x > w + 220) {
                return;
            }

            const ht = o.h * scale;
            const sw = o.w * scale;

            const v = (dx, dy) => [
                x + sw * dx,
                y - ht * dy
            ];

            const tone = blend(
                c.shade,
                c.light,
                0.12
            );

            const dark = blend(
                c.shade,
                0x29243b,
                0.28
            );

            // Clouds

            if (o.prop === 'cloud') {

                for (const [dx, dy, r] of [
                    [-0.7, 0.27, 0.7],
                    [0.2, 0.49, 0.95],
                    [0.9, 0.35, 0.62]
                ]) {
                    g.ellipse(
                        x + dx * sw,
                        y - dy * ht,
                        sw * r,
                        ht * 0.23
                    ).fill(0xebe6f5);
                }

            // Candy and blossom trees

            } else if (
                o.prop === 'candy' ||
                o.prop === 'blossom'
            ) {

                g.rect(
                    x - sw * 0.12,
                    y - ht * 0.86,
                    sw * 0.24,
                    ht * 0.86
                ).fill(0x956f81);

                const col = o.prop === 'blossom'
                    ? 0xeeacbd
                    : 0xfd92c1;

                g.poly([
                    ...v(-0.95, 0.63),
                    ...v(-0.75, 0.91),
                    ...v(-0.1, 1),
                    ...v(0.7, 0.95),
                    ...v(1.05, 0.74),
                    ...v(0.5, 0.53),
                    ...v(-0.55, 0.5)
                ]).fill(col);

                tri(
                    v(-0.95, 0.63),
                    v(-0.1, 1),
                    v(0.25, 0.69),
                    blend(col, 0xffffff, 0.3)
                );

                if (o.prop === 'candy') {
                    line([
                        v(-0.6, 0.65),
                        v(-0.23, 0.88),
                        v(0.5, 0.79),
                        v(0.13, 0.64)
                    ], 0xffe9f9, Math.max(1, sw * 0.13));
                }

            // Sailboats

            } else if (o.prop === 'sail') {

                tri(
                    v(0, 0.12),
                    v(0, 1),
                    v(-1, 0.21),
                    0xffe0bd
                );

                tri(
                    v(0.07, 0.2),
                    v(0.07, 0.85),
                    v(0.8, 0.23),
                    0xe7a39a
                );

                g.poly([
                    ...v(-1, 0.18),
                    ...v(1, 0.18),
                    ...v(0.56, 0),
                    ...v(-0.59, 0)
                ]).fill(dark);

            // Houses

            } else if (o.prop === 'house') {

                g.poly([
                    ...v(-1, 0),
                    ...v(-1, 0.48),
                    ...v(0.2, 0.51),
                    ...v(0.2, 0)
                ]).fill(0xe0c6ae);

                g.poly([
                    ...v(0.2, 0),
                    ...v(0.2, 0.51),
                    ...v(1, 0.45),
                    ...v(1, 0.04)
                ]).fill(0xad9294);

                tri(
                    v(-1.16, 0.45),
                    v(-0.22, 1),
                    v(0.3, 0.48),
                    0x9b6876
                );

                g.poly([
                    ...v(-0.22, 1),
                    ...v(0.8, 0.85),
                    ...v(1.14, 0.42),
                    ...v(0.3, 0.48)
                ]).fill(0xbd827b);

            // Palm trees

            } else if (o.prop === 'palm') {

                g.poly([
                    ...v(-0.15, 0),
                    ...v(0.04, 0.85),
                    ...v(0.22, 0.86),
                    ...v(0.13, 0)
                ]).fill(0xa57d69);

                for (let i = -2; i <= 2; i++) {

                    tri(
                        v(0.13, 0.84),
                        v(i * 0.45, 0.98),
                        v(
                            i * 0.75,
                            0.59 + Math.abs(i) * 0.045
                        ),
                        i % 2 ? 0x4d9c87 : 0x326f72
                    );
                }

            // Cactus

            } else if (o.prop === 'cactus') {

                g.roundRect(
                    x - sw * 0.32,
                    y - ht,
                    sw * 0.64,
                    ht,
                    sw * 0.28
                ).fill(0x718a70);

                line([
                    v(-0.84, 0.71),
                    v(-0.84, 0.49),
                    v(-0.23, 0.49)
                ], 0x798e70, Math.max(sw * 0.36, 1));

                line([
                    v(0.7, 0.56),
                    v(0.7, 0.35),
                    v(0.24, 0.35)
                ], 0x5a7664, Math.max(sw * 0.33, 1));

            // Rocks and ice

            } else if (
                ['rock', 'ice', 'basalt'].includes(o.prop)
            ) {

                const col = o.prop === 'ice'
                    ? 0xb6eff6
                    : o.prop === 'basalt'
                        ? 0x63556b
                        : 0xbb9281;

                tri(
                    v(-1, 0),
                    v(-0.27, 1),
                    v(0.18, 0.05),
                    blend(col, 0xffffff, 0.18)
                );

                tri(
                    v(0.18, 0.05),
                    v(-0.27, 1),
                    v(0.77, 0.76),
                    col
                );

                tri(
                    v(0.18, 0.05),
                    v(0.77, 0.76),
                    v(0.95, 0.02),
                    blend(col, 0x392d46, 0.28)
                );

            // Pine trees

            } else {

                g.rect(
                    x - sw * 0.1,
                    y - ht * 0.23,
                    sw * 0.2,
                    ht * 0.23
                ).fill(dark);

                for (let a = 0; a < 3; a++) {

                    const foot = 0.11 + a * 0.22;
                    const tip = 0.59 + a * 0.21;
                    const wide = 1 - a * 0.24;

                    tri(
                        v(-wide, foot),
                        v(-0.06, tip),
                        v(0.14, foot + 0.025),
                        tone
                    );

                    tri(
                        v(0.14, foot + 0.025),
                        v(-0.06, tip),
                        v(wide, foot + 0.07),
                        dark
                    );

                    if (
                        ['Alpine', 'Snowfield'].includes(c.biome)
                    ) {
                        tri(
                            v(-0.06, tip),

                            v(
                                -wide * 0.44,
                                foot + (tip - foot) * 0.52
                            ),

                            v(
                                wide * 0.42,
                                foot + (tip - foot) * 0.58
                            ),

                            blend(c.light, 0xffffff, 0.35)
                        );
                    }
                }
            }
        }

        // =====================================
        // CHECKPOINT RINGS
        // =====================================

        function ring(a, active = false) {

            const [x, y] = project(a.x, a.y, a.z);

            const r = (a.radius ?? 7.3) *
                focus / (a.z - camera.z);

            if (r <= 0 || r > w * 1.5) return;

            const color = {
                time: 0xffd882,
                wind: 0xc7fa8d,
                ring: 0x9aedfb,
                checkpoint: 0xffd585,
                finish: 0xe2fc98
            }[a.type];

            const emphasis =
                a.type === 'checkpoint' && !active
                    ? 0.48
                    : 1;

            g.circle(x, y, r).stroke({
                color,
                width: Math.max(2, r * 0.22),
                alpha: 0.18 * emphasis
            });

            g.circle(x, y, r).stroke({
                color,
                width: Math.max(1.1, r * 0.07),
                alpha: 0.95 * emphasis
            });

            g.circle(x, y, r * 0.974).stroke({
                color: 0xffffff,
                width: Math.max(0.6, r * 0.014),
                alpha: 0.85 * emphasis
            });

            // Animated highlights without diagonal lines

            if (active) {

                const angle = s.elapsed * 2.8;

                for (const start of [
                    angle,
                    angle + Math.PI
                ]) {

                    g.moveTo(
                        x + r * Math.cos(start),
                        y + r * Math.sin(start)
                    );

                    g.arc(
                        x,
                        y,
                        r,
                        start,
                        start + 0.9
                    ).stroke({
                        color: 0xffffff,
                        width: Math.max(1, r * 0.045),
                        alpha: 0.9
                    });
                }
            }
        }

        // =====================================
        // QUANTUM CRYSTALS
        // =====================================

        function gem(a) {

            const [x, y] = project(
                a.x,
                a.y,
                a.z - 24
            );

            const size =
                1.6 * focus / (a.z - 24 - camera.z);

            const stretch =
                0.7 + 0.27 * Math.sin(s.elapsed * 3);

            const top = [x, y - size];
            const bottom = [x, y + size];
            const middle = [x, y + size * 0.08];

            tri(
                top,
                middle,
                [x - size * stretch, y],
                0xe0bfff
            );

            tri(
                top,
                [x + size * stretch, y],
                middle,
                0xfbebff
            );

            tri(
                bottom,
                middle,
                [x - size * stretch, y],
                0x9a68d7
            );

            tri(
                bottom,
                [x + size * stretch, y],
                middle,
                0xc892fa
            );
        }

        const items = [];

        const timed = s.requiredRings > 0;

        // =====================================
        // GENERATE VISIBLE OBJECTS
        // =====================================

        for (
            let i = Math.max(
                0,
                Math.floor(camera.z / 34) - 1
            );

            i < Math.ceil((camera.z + 545) / 34);

            i++
        ) {

            for (const o of obstacles(c, i, timed)) {

                if (o.z > camera.z + 3) {

                    items.push({
                        z: o.z,
                        paint: () => prop(o)
                    });
                }
            }
        }

        for (
            let i = Math.max(0, s.cursor - 1);

            i < s.cursor + 9;

            i++
        ) {

            if (timed && i >= s.requiredRings) {
                break;
            }

            const a = gate(c, i, timed);

            if (a.z > camera.z + 4 && i >= s.cursor) {

                items.push({
                    z: a.z,
                    paint: () => ring(
                        a,
                        timed && i === s.cursor
                    )
                });
            }

            if (
                a.z - 24 > camera.z + 4 &&
                i >= s.gemCursor
            ) {

                items.push({
                    z: a.z - 24,
                    paint: () => gem(a)
                });
            }
        }

        // Finish ring for Career and Private Race

        if (timed && c.length > camera.z + 2) {

            const finish = finishGate(c);

            items.push({
                z: finish.z,
                paint: () => ring(
                    finish,
                    s.cursor === s.requiredRings
                )
            });
        }

        // =====================================
        // ICE CEILINGS
        // =====================================

        if (c.prop === 'ice') {

            for (
                let z = 240 + 180 * Math.max(
                    0,
                    Math.ceil((camera.z + 5 - 240) / 180)
                );

                z < camera.z + 545;

                z += 180
            ) {

                items.push({
                    z,

                    paint: () => {

                        const left = project(-90, 33, z);
                        const middle = project(0, 27, z);
                        const right = project(90, 33, z);
                        const top = project(0, 53, z);

                        tri(left, middle, top, 0xa8dce4);
                        tri(middle, right, top, 0xd5f3ed);
                    }
                });
            }
        }

        // =====================================
        // MULTIPLAYER OPPONENT
        // =====================================

        if (
            peer &&
            peer.z > camera.z + 4 &&
            Math.abs(peer.z - s.z) < 500
        ) {

            items.push({

                z: peer.z,

                paint: () => {

                    const point = project(
                        peer.x,
                        peer.y,
                        peer.z
                    );

                    const size = 3.6 * focus /
                        (peer.z - camera.z);

                    tri(
                        [
                            point[0],
                            point[1] - size * 0.4
                        ],

                        [
                            point[0] - size,
                            point[1] + size * 0.2
                        ],

                        [
                            point[0] + size,
                            point[1] + size * 0.2
                        ],

                        0xffc278
                    );
                }
            });
        }

        // =====================================
        // DRAW LOW-POLY LANDSCAPE
        // =====================================

        items.sort((a, b) => b.z - a.z);

        let j = 0;

        const cols = Math.ceil(
            w / focus * 550 / span / 2
        ) + 2;

        let farVertices = [];

        for (
            let row = rowFloor + 15;

            row >= rowFloor;

            row--
        ) {

            const far = (row + 1) * depth;

            const lo = Math.max(
                3,

                Math.min(
                    cols,

                    Math.ceil(
                        w / focus *
                        (far - camera.z) /
                        span / 2
                    ) + 3
                )
            );

            const nearVertices = [];

            for (
                let k = column - lo;

                k <= column + lo + 1;

                k++
            ) {

                nearVertices[k - column + cols] =
                    vertex(k, row);
            }

            for (
                let k = column - lo;

                k <= column + lo;

                k++
            ) {

                const i = k - column + cols;

                const a = nearVertices[i];
                const b = nearVertices[i + 1];

                const d = farVertices[i] ??
                    vertex(k, row + 1);

                const e = farVertices[i + 1] ??
                    vertex(k + 1, row + 1);

                const phase =
                    0.5 + 0.5 * Math.sin(
                        k * 3.4 +
                        row * 2.27 +
                        c.id * 0.92
                    );

                const fog = clamp(
                    (far - camera.z - 160) / 600,
                    0,
                    0.67
                );

                const colA = blend(

                    blend(
                        c.ground,
                        c.shade,
                        0.06 + phase * 0.18
                    ),

                    c.light,
                    fog
                );

                const colB = blend(

                    blend(
                        c.ground,
                        c.light,
                        0.05 + (1 - phase) * 0.19
                    ),

                    c.light,
                    fog
                );

                tri(a, b, d, colA);
                tri(b, e, d, colB);
            }

            farVertices = nearVertices;

            while (
                j < items.length &&
                items[j].z >= row * depth
            ) {
                items[j].paint();
                j++;
            }
        }

        // =====================================
        // PLAYER AIRCRAFT POSITION
        // =====================================

        const [px, py] = project(
            s.x,
            s.y,
            s.z
        );

        const scale = clamp(
            Math.min(w * 0.071, h * 0.14),
            29,
            110
        );

        // =====================================
        // WIND SPEED EFFECTS
        // =====================================

        if (this.showStreaks && s.forwardSpeed > 4) {

            const intensity = clamp(
                s.forwardSpeed / 26,
                0,
                1
            );

            for (let i = 0; i < 18; i++) {

                const angle = i * 2.39996;

                const phase =
                    (s.z * 0.042 + i * 0.61803) % 1;

                const reach = 0.29 + phase * 0.48;

                const length =
                    (0.028 + intensity * 0.043) * phase;

                const dx = Math.cos(angle) * w;
                const dy = Math.sin(angle) * h;

                line([
                    [
                        cx + dx * reach,
                        cy + dy * reach
                    ],

                    [
                        cx + dx * (reach + length),
                        cy + dy * (reach + length)
                    ]
                ],

                    0xfff8ed,

                    1 + phase * 0.55,

                    Math.sin(phase * Math.PI) *
                    intensity * 0.22
                );
            }
        }

        // =====================================
        // 3D AIRCRAFT RENDERER
        // =====================================

        drawAircraft(
            g,
            s,
            skin,
            px,
            py,
            scale
        );

        this.app.render();
    }
}