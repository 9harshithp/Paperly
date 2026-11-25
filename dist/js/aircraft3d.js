import { airframes } from './airframes.js';
import { skins } from './data.js';

function shade(color, amount) {
    const r = Math.min(255, Math.round(
        ((color >> 16) & 255) * amount
    ));

    const g = Math.min(255, Math.round(
        ((color >> 8) & 255) * amount
    ));

    const b = Math.min(255, Math.round(
        (color & 255) * amount
    ));

    return (r << 16) | (g << 8) | b;
}

export function aircraftProjection(
    planeId,
    skin,
    roll,
    pitch,
    yaw,
    px,
    py,
    scale
) {
    const shape = airframes[planeId];
    const color = skins[skin][1];

    const faces = [];
    const tips = [];

    const cr = Math.cos(roll);
    const sr = Math.sin(roll);

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);

    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    const cameraAngle = 0.42;

    function project3D(point) {
        const [x, y, z] = point;

        // Roll around the aircraft's longitudinal axis
        const x1 = x * cr + y * sr;
        const y1 = -x * sr + y * cr;

        // Pitch around the lateral axis
        const y2 = y1 * cp + z * sp;
        const z2 = z * cp - y1 * sp;

        // Yaw around the vertical axis
        const x3 = x1 * cy + z2 * sy;
        const z3 = z2 * cy - x1 * sy;

        // Chase-camera projection
        const depth =
            4 +
            z3 * Math.cos(cameraAngle) -
            y2 * Math.sin(cameraAngle);

        const vertical =
            y2 * Math.cos(cameraAngle) +
            z3 * Math.sin(cameraAngle);

        const perspective =
            4 / Math.max(1, depth);

        return {
            x: px + x3 * scale * perspective,
            y: py - vertical * scale * perspective,
            depth
        };
    }

    function addFace(vertices, faceColor) {
        const points = vertices.map(project3D);

        const depth = points.reduce(
            (sum, point) => sum + point.depth,
            0
        ) / points.length;

        faces.push({
            points,
            depth,
            color: faceColor
        });
    }

    const nose = [
        0,
        0.04,
        -shape.nose * 2.2 + 0.25
    ];

    const tail = [
        0,
        -0.20,
        -shape.tail * 2
    ];

    for (const side of [-1, 1]) {

        const wing = shape.wing.map(([x, y]) => [
            side * x,
            x * 0.09,
            -y * 2.2
        ]);

        const fold = wing[wing.length - 1];

        addFace(
            [nose, ...wing],
            shade(color, side < 0 ? 1 : 0.88)
        );

        addFace(
            [nose, fold, tail],
            shade(color, side < 0 ? 0.67 : 0.79)
        );

        if (shape.crease !== undefined) {
            addFace(
                [nose, ...wing.slice(shape.crease)],
                shade(color, 0.76)
            );
        }

        if (shape.fins) {
            addFace(
                shape.fins.map(([x, y]) => [
                    side * x,
                    0.15 + x * 0.1,
                    -y * 2.2
                ]),
                shade(color, 0.82)
            );
        }

        const tip = wing[shape.tip ?? 0];

        tips.push(project3D(tip));
    }

    if (shape.canopy) {
        addFace(
            shape.canopy.map(([x, y]) => [
                x,
                0.17,
                -y * 2.2
            ]),
            shade(color, 0.9)
        );
    }

    // Render distant surfaces first
    faces.sort((a, b) => b.depth - a.depth);

    return { faces, tips };
}

export function drawAircraft(
    g,
    state,
    skin,
    px,
    py,
    scale
) {
    const yaw = Math.atan2(
        state.vx,
        Math.max(state.forwardSpeed, 5)
    ) * 0.6;

    const model = aircraftProjection(
        state.plane.id,
        skin,
        state.bank,
        state.pitch,
        yaw,
        px,
        py,
        scale
    );

    // Trails originate from projected 3D wing tips
    for (const tip of model.tips) {
        g.moveTo(tip.x, tip.y)
            .quadraticCurveTo(
                tip.x - state.vx * 0.8,
                tip.y + scale * 0.5,
                tip.x - state.vx * 2,
                tip.y + scale * (
                    0.7 + state.forwardSpeed * 0.025
                )
            )
            .stroke({
                color: 0xffffff,
                width: state.boosting ? 2.4 : 1.1,
                alpha: 0.48
            });
    }

    for (const face of model.faces) {
        const coordinates = face.points.flatMap(
            point => [point.x, point.y]
        );

        g.poly(coordinates).fill(face.color);
    }
}

export function drawHangarPlane(canvas, planeId, skin) {
    const ctx = canvas.getContext('2d');

    ctx.clearRect(
        0, 0,
        canvas.width,
        canvas.height
    );

    const model = aircraftProjection(
        planeId,
        skin,
        -0.18,
        0.12,
        0.25,
        canvas.width / 2,
        canvas.height / 2,
        85
    );

    for (const face of model.faces) {
        ctx.beginPath();

        face.points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });

        ctx.closePath();

        ctx.fillStyle = '#' +
            face.color.toString(16).padStart(6, '0');

        ctx.fill();
    }
}