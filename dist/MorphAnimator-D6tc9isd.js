var p = 3, d = {
  idle: { init: "ready" },
  ready: {
    penDown: "drawing",
    unbind: "idle",
    export_start: "exporting"
  },
  drawing: {
    penUp: "pen_up_wait",
    penUp_short: "ready"
  },
  pen_up_wait: {
    timeout: "morphing",
    penDown: "drawing"
  },
  morphing: {
    morph_complete: "ready",
    recognize_start: "recognizing"
  },
  recognizing: {
    recognize_complete: "morphing",
    recognize_fail: "ready"
  },
  exporting: {
    export_complete: "ready",
    export_fail: "ready"
  }
}, S = class {
  state = "idle";
  delayTimer = null;
  eventBus;
  constructor(e) {
    this.eventBus = e;
  }
  transition(e) {
    const t = d[this.state]?.[e];
    if (!t) return !1;
    const r = this.state;
    return this.state = t, this.eventBus.emit("state:change", {
      from: r,
      to: t,
      action: e
    }), !0;
  }
  getState() {
    return this.state;
  }
  getPenUpAction(e) {
    return e >= p ? "penUp" : "penUp_short";
  }
  startMorphDelay(e, t = 300) {
    this.cancelMorphDelay(), this.delayTimer = setTimeout(() => {
      this.delayTimer = null, e();
    }, t);
  }
  cancelMorphDelay() {
    this.delayTimer !== null && (clearTimeout(this.delayTimer), this.delayTimer = null);
  }
  hasPendingDelay() {
    return this.delayTimer !== null;
  }
  destroy() {
    this.cancelMorphDelay(), this.state = "idle";
  }
}, m = 2 * Math.PI / 3, f = -10, g = 0.75, y = 10;
function v(e) {
  return e === 0 || e === 1 ? e : Math.pow(2, f * e) * Math.sin((e * y - g) * m) + 1;
}
function _(e, t) {
  if (e.length < 2 || t < 2) return [...e];
  const r = [], a = e.length - 1, o = t - 1;
  for (let s = 0; s < t; s++) {
    const n = s / o * a, c = Math.floor(n), u = Math.min(c + 1, e.length - 1), h = n - c, i = e[c], l = e[u];
    r.push({
      x: i.x + (l.x - i.x) * h,
      y: i.y + (l.y - i.y) * h,
      t: i.t + (l.t - i.t) * h,
      pressure: i.pressure + (l.pressure - i.pressure) * h
    });
  }
  return r;
}
function P(e, t, r) {
  const a = [];
  for (let o = 0; o < t.length; o++) {
    const s = e[o], n = t[o];
    a.push({
      x: s.x + (n.x - s.x) * r,
      y: s.y + (n.y - s.y) * r,
      t: n.t,
      pressure: s.pressure + (n.pressure - s.pressure) * r
    });
  }
  return a;
}
var T = class {
  elapsed = 0;
  active = !1;
  duration;
  eventBus;
  effect;
  fromPoints;
  toPoints;
  rawPoints;
  constructor(e) {
    this.duration = e.duration ?? 1200, this.eventBus = e.eventBus, this.effect = e.effect, this.toPoints = e.smoothed, this.rawPoints = e.raw, this.fromPoints = _(e.raw, e.smoothed.length);
  }
  start() {
    this.elapsed = 0, this.active = !0, this.eventBus.emit("morph:start");
  }
  update(e) {
    if (!this.active) return null;
    this.elapsed = Math.min(this.elapsed + e, this.duration);
    const t = this.elapsed / this.duration, r = v(t), a = P(this.fromPoints, this.toPoints, r);
    return t >= 1 && (this.active = !1, this.eventBus.emit("morph:complete")), a;
  }
  cancel() {
    this.active = !1;
  }
  getProgress() {
    return Math.min(this.elapsed / this.duration, 1);
  }
  get progress() {
    return this.getProgress();
  }
  isActive() {
    return this.active;
  }
  getSmoothedPoints() {
    return this.toPoints;
  }
  get sourceStroke() {
    return {
      raw: this.rawPoints,
      smoothed: this.toPoints,
      effect: this.effect
    };
  }
};
export {
  v as n,
  S as r,
  T as t
};

//# sourceMappingURL=MorphAnimator-D6tc9isd.js.map