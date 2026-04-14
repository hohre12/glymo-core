import { o as m } from "./math-TYtc93wB.js";
var M = class {
  matchAll(t, e) {
    if (e.length === 0 || t.length === 0) return [];
    const c = x(g(t), e);
    return e.map((n, o) => {
      const r = b(c[o] ?? [], n.points, o);
      return {
        char: n.char,
        charIndex: o,
        pairs: r
      };
    });
  }
};
function g(t) {
  const e = [];
  for (const c of t) for (const n of c) e.push({
    x: n.x,
    y: n.y
  });
  return e;
}
function x(t, e) {
  const c = e.reduce((r, s) => r + s.points.length, 0);
  if (c === 0 || t.length === 0) return e.map(() => []);
  const n = [];
  let o = 0;
  for (let r = 0; r < e.length; r++) {
    const s = e[r].points.length / c, i = r === e.length - 1 ? t.length - o : Math.round(t.length * s);
    n.push(t.slice(o, o + i)), o += i;
  }
  return n;
}
function b(t, e, c) {
  if (t.length === 0 || e.length === 0) return [];
  const n = Math.max(t.length, e.length);
  return S(m(t, n), m(e, n), c);
}
function S(t, e, c) {
  const n = t.length, o = /* @__PURE__ */ new Set(), r = [];
  for (let s = 0; s < n; s++) {
    const i = e[s];
    let l = 1 / 0, f = 0;
    for (let u = 0; u < n; u++) {
      if (o.has(u)) continue;
      const a = i.x - t[u].x, h = i.y - t[u].y, p = a * a + h * h;
      p < l && (l = p, f = u);
    }
    o.add(f), r.push({
      hand: t[f],
      font: i,
      charIndex: c,
      pointIndex: s
    });
  }
  return r;
}
export {
  M as PointMatcher
};

//# sourceMappingURL=PointMatcher-DK4by-C2.js.map