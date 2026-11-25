export class Sound {

    constructor() {
        this.enabled = true;
        this.wasBoosting = false;
        this.musicIndex = 0;
    }

    start() {
        try {
            if (!this.ctx) {
                const Audio = window.AudioContext ||
                    window.webkitAudioContext;

                this.ctx = new Audio();

                const c = this.ctx;

                this.master = c.createGain();
                this.master.gain.value =
                    this.enabled ? 0.7 : 0;

                this.master.connect(c.destination);

                // Soft airflow
                const buffer = c.createBuffer(
                    1,
                    c.sampleRate * 4,
                    c.sampleRate
                );

                const samples = buffer.getChannelData(0);

                let previous = 0;

                for (let i = 0; i < samples.length; i++) {
                    previous = (
                        previous +
                        (Math.random() * 2 - 1) * 0.018
                    ) / 1.018;

                    samples[i] = previous;
                }

                const airflow = c.createBufferSource();

                airflow.buffer = buffer;
                airflow.loop = true;

                this.filter = c.createBiquadFilter();

                this.filter.type = 'lowpass';
                this.filter.frequency.value = 450;

                this.gain = c.createGain();
                this.gain.gain.value = 0;

                airflow.connect(this.filter);
                this.filter.connect(this.gain);
                this.gain.connect(this.master);

                airflow.start();

                // Ambient instrumental melody
                this.melody = [
                    261.63, 329.63, 392.00, 440.00,
                    329.63, 392.00, 293.66, 349.23,
                    440.00, 392.00, 329.63, 261.63
                ];

                this.musicTimer = setInterval(() => {
                    if (
                        !this.enabled ||
                        this.ctx.state !== 'running'
                    ) return;

                    const frequency = this.melody[
                        this.musicIndex %
                        this.melody.length
                    ];

                    this.note(
                        frequency,
                        1.8,
                        0.055,
                        'sine'
                    );

                    if (this.musicIndex % 4 === 0) {
                        this.note(
                            frequency / 2,
                            2.8,
                            0.035,
                            'sine'
                        );
                    }

                    this.musicIndex++;

                }, 850);
            }

            this.master.gain.value =
                this.enabled ? 0.7 : 0;

            this.ctx.resume().catch(console.warn);

        } catch (error) {
            console.error('Audio error:', error);
        }
    }

    note(
        frequency,
        duration = 0.5,
        volume = 0.08,
        type = 'sine',
        delay = 0
    ) {
        if (!this.ctx || !this.enabled) return;

        const c = this.ctx;

        const oscillator = c.createOscillator();
        const gain = c.createGain();

        const start = c.currentTime + delay;

        oscillator.type = type;

        oscillator.frequency.setValueAtTime(
            frequency,
            start
        );

        gain.gain.setValueAtTime(0.001, start);

        gain.gain.exponentialRampToValueAtTime(
            volume,
            start + 0.025
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            start + duration
        );

        oscillator.connect(gain);
        gain.connect(this.master);

        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    wind(speed = 0, boosting = false) {
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        this.master.gain.setTargetAtTime(
            this.enabled ? 0.7 : 0,
            now,
            0.05
        );

        this.gain.gain.setTargetAtTime(
            Math.min(0.20, speed / 180),
            now,
            0.3
        );

        this.filter.frequency.setTargetAtTime(
            220 + speed * 16,
            now,
            0.3
        );

        if (boosting && !this.wasBoosting) {
            this.chime('boost');
        }

        this.wasBoosting = boosting;
    }

    chime(kind) {
        if (!this.ctx || !this.enabled) return;

        const sounds = {
            click: [392],
            gem: [783.99, 1046.5, 1318.5],
            ring: [523.25, 659.25],
            time: [523.25, 659.25, 880],
            wind: [220, 329.63, 440],
            boost: [146.83, 293.66, 587.33],
            complete: [
                261.63, 329.63,
                392, 523.25, 659.25
            ],
            fail: [329.63, 246.94, 196],
            crash: [110, 73.42, 55]
        };

        const notes = sounds[kind] || [440];

        notes.forEach((frequency, index) => {
            this.note(
                frequency,
                kind === 'complete' ? 1.2 : 0.55,
                kind === 'crash' ? 0.15 : 0.09,
                kind === 'crash' ? 'triangle' : 'sine',
                index * 0.12
            );
        });
    }
}