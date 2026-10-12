// Cursor Cat for GNOME Shell (Ubuntu): the cat lives on top of every window and chases
// the mouse pointer. The shell itself reads the pointer, so it works on Wayland too.
//
// scripts/build-gnome.mjs puts shared/brain.js (CatBrain, SPRITE, allSprites) in front
// of this file and wraps it for GNOME 45+ (ES modules) and GNOME 42–44 (legacy).

const DEFAULT_CONFIG = {coat: 'ginger', size: 72, speed: 1};

function readConfig(dir) {
    try {
        const [ok, bytes] = GLib.file_get_contents(`${dir}/config.json`);
        if (ok)
            return {...DEFAULT_CONFIG, ...JSON.parse(new TextDecoder().decode(bytes))};
    } catch (e) {
        // No or broken config: use the defaults.
    }
    return {...DEFAULT_CONFIG};
}

class CursorCat {
    constructor(dir) {
        const config = readConfig(dir);
        this._size = config.size;
        this._brain = new CatBrain({size: config.size, speed: config.speed});

        // One FileIcon per frame; St caches the textures.
        this._icons = {};
        for (const [name, count] of Object.entries(allSprites())) {
            this._icons[name] = [];
            for (let i = 0; i < count; i++)
                this._icons[name].push(Gio.FileIcon.new(Gio.File.new_for_path(`${dir}/sprites/${name}-${i}.png`)));
        }

        // Not reactive, so clicks go straight through to the windows below.
        this.actor = new St.Icon({icon_size: this._size, reactive: false, can_focus: false});
        Main.uiGroup.add_child(this.actor);

        const [px, py] = global.get_pointer();
        [this._brain.x, this._brain.y] = this._brain.target(px, py);
        this._lastFrame = '';
        this._lastX = NaN;
        this._lastY = NaN;
        this._time = GLib.get_monotonic_time();
        this._tick();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _tick() {
        const now = GLib.get_monotonic_time();
        const dt = (now - this._time) / 1e6;
        this._time = now;

        const [px, py] = global.get_pointer();
        const s = this._brain.update(dt, px, py);
        const x = Math.round(s.x - (SPRITE.anchorX / SPRITE.size) * this._size);
        const y = Math.round(s.y - (SPRITE.anchorY / SPRITE.size) * this._size);
        if (x !== this._lastX || y !== this._lastY) {
            this.actor.set_position(x, y);
            this._lastX = x;
            this._lastY = y;
        }
        const frame = `${s.sprite}/${s.frame}`;
        if (frame !== this._lastFrame) {
            this.actor.gicon = this._icons[s.sprite][s.frame];
            this._lastFrame = frame;
        }
    }

    // Used by tests.
    get state() {
        return this._brain.state();
    }

    destroy() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        this.actor.destroy();
        this.actor = null;
    }
}
