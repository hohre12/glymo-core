import { o as P } from "./math-TYtc93wB.js";
var I = class {
  cache = /* @__PURE__ */ new Map();
  constructor(t = 128) {
    this.maxSize = t;
  }
  key(t, n) {
    return `${t}::${n}`;
  }
  get(t, n) {
    const i = this.key(t, n), e = this.cache.get(i);
    return e && (this.cache.delete(i), this.cache.set(i, e)), e;
  }
  set(t, n, i) {
    const e = this.key(t, n);
    if (this.cache.has(e) && this.cache.delete(e), this.cache.set(e, i), this.cache.size > this.maxSize) {
      const r = this.cache.keys().next().value;
      r !== void 0 && this.cache.delete(r);
    }
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
}, x = 128, A = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
], d = 4, g = 3, E = 128, u = 10, m = 2, _ = 0.5, C = class {
  cache;
  config;
  constructor(t) {
    this.config = { ...t }, this.cache = new I(128);
  }
  async ensureFontLoaded(t) {
    const n = b(t);
    try {
      if (await Promise.race([document.fonts.ready, new Promise((i, e) => setTimeout(() => e(/* @__PURE__ */ new Error("Font load timeout")), 3e3))]), document.fonts.check(t)) return t;
    } catch {
    }
    return t.replace(n, "sans-serif");
  }
  async extractAll(t) {
    const n = await this.ensureFontLoaded(this.config.font), i = [];
    for (const e of t)
      if (e.trim() !== "")
        try {
          const r = this.extractChar(e, n);
          i.push(r);
        } catch {
          continue;
        }
    return i;
  }
  extractChar(t, n) {
    const i = this.cache.get(t, n);
    if (i) return i;
    const e = E, r = new OffscreenCanvas(e, e).getContext("2d");
    r.clearRect(0, 0, e, e), r.font = n, r.fillStyle = "#000000", r.textBaseline = "middle", r.textAlign = "center", r.fillText(t, e / 2, e / 2);
    const o = r.getImageData(0, 0, e, e), c = k(this.detectBorderPixels(o, e, e, m)), a = c.length >= 2 ? P(c, this.config.glyphPointCount) : c, s = {
      char: t,
      points: a,
      bbox: p(a, e),
      fontUsed: n
    };
    return this.cache.set(t, n, s), s;
  }
  detectBorderPixels(t, n, i, e = m) {
    const r = t.data, o = [];
    for (let c = 0; c < i; c += e) for (let a = 0; a < n; a += e) {
      if (r[(c * n + a) * d + g] < x) continue;
      let s = !1;
      for (const [l, f] of A) {
        const h = a + l * e, y = c + f * e;
        if (h < 0 || y < 0 || h >= n || y >= i) {
          s = !0;
          break;
        }
        if (r[(y * n + h) * d + g] < x) {
          s = !0;
          break;
        }
      }
      s && o.push({
        x: a,
        y: c
      });
    }
    if (o.length < this.config.glyphPointCount * _) {
      const c = e + 1;
      for (let a = 0; a < i; a += c) for (let s = 0; s < n; s += c) r[(a * n + s) * d + g] > x && o.push({
        x: s,
        y: a
      });
    }
    return o;
  }
  updateConfig(t) {
    Object.assign(this.config, t);
  }
  clearCache() {
    this.cache.clear();
  }
};
function b(t) {
  const n = t.split(/\s+/).slice(1);
  return n.length === 0 ? "sans-serif" : n.join(" ").replace(/["']/g, "");
}
function k(t) {
  if (t.length <= 2) return t;
  const n = [], i = new Uint8Array(t.length);
  let e = 0;
  for (let r = 1; r < t.length; r++) {
    const o = t[e], c = t[r];
    (c.y < o.y || c.y === o.y && c.x < o.x) && (e = r);
  }
  n.push(t[e]), i[e] = 1;
  for (let r = 1; r < t.length; r++) {
    const o = n[n.length - 1];
    let c = -1, a = 1 / 0;
    for (let s = 0; s < t.length; s++) {
      if (i[s]) continue;
      const l = t[s].x - o.x, f = t[s].y - o.y, h = l * l + f * f;
      h < a && (a = h, c = s);
    }
    if (c === -1) break;
    n.push(t[c]), i[c] = 1;
  }
  return n;
}
function p(t, n) {
  if (t.length === 0) return {
    x: 0,
    y: 0,
    width: n,
    height: n
  };
  let i = 1 / 0, e = 1 / 0, r = -1 / 0, o = -1 / 0;
  for (const c of t)
    c.x < i && (i = c.x), c.y < e && (e = c.y), c.x > r && (r = c.x), c.y > o && (o = c.y);
  return {
    x: Math.max(0, i - u),
    y: Math.max(0, e - u),
    width: Math.min(n, r - i + u * 2),
    height: Math.min(n, o - e + u * 2)
  };
}
export {
  C as t
};

//# sourceMappingURL=GlyphExtractor-pPO-G6Je.js.map