var d = 16, l = 255;
function m(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function y(t, e) {
  const n = e.x - t.x, i = e.y - t.y;
  return Math.sqrt(n * n + i * i);
}
function s(t) {
  const e = t.startsWith("#") ? t.slice(1) : t, n = parseInt(e, d);
  return {
    r: n >> 16 & l,
    g: n >> 8 & l,
    b: n & l
  };
}
function M(t, e, n) {
  return {
    r: Math.round(t.r + (e.r - t.r) * n),
    g: Math.round(t.g + (e.g - t.g) * n),
    b: Math.round(t.b + (e.b - t.b) * n)
  };
}
function x(t) {
  return `rgb(${t.r}, ${t.g}, ${t.b})`;
}
function T(t, e) {
  if (t.length === 0) return "rgb(0, 0, 0)";
  if (t.length === 1) return x(s(t[0]));
  const n = m(e, 0, 1), i = t.length - 1, c = n * i, r = Math.min(Math.floor(c), i - 1), a = c - r;
  return x(M(s(t[r]), s(t[r + 1]), a));
}
function X(t) {
  let e = 1 / 0, n = 1 / 0, i = -1 / 0, c = -1 / 0;
  for (const r of t)
    r.x < e && (e = r.x), r.y < n && (n = r.y), r.x > i && (i = r.x), r.y > c && (c = r.y);
  return isFinite(e) ? {
    x: e,
    y: n,
    width: i - e,
    height: c - n
  } : {
    x: 0,
    y: 0,
    width: 100,
    height: 100
  };
}
function p(t, e) {
  if (t.length < 2 || e < 2) return [...t];
  const n = b(t);
  if (n === 0) return [...t];
  const i = n / (e - 1);
  return I(t.map((c) => ({ ...c })), e, i);
}
function b(t) {
  let e = 0;
  for (let n = 1; n < t.length; n++) e += y(t[n - 1], t[n]);
  return e;
}
function I(t, e, n) {
  const i = [{
    x: t[0].x,
    y: t[0].y
  }];
  let c = 0, r = 1;
  for (; i.length < e - 1 && r < t.length; ) {
    const u = t[r - 1], f = t[r], h = y(u, f);
    if (c + h >= n) {
      const o = (n - c) / h, g = {
        x: u.x + o * (f.x - u.x),
        y: u.y + o * (f.y - u.y)
      };
      i.push(g), t.splice(r, 0, g), c = 0, r++;
    } else
      c += h, r++;
  }
  const a = t[t.length - 1];
  return i.push({
    x: a.x,
    y: a.y
  }), i;
}
export {
  T as a,
  s as i,
  X as n,
  p as o,
  y as r,
  m as t
};

//# sourceMappingURL=math-TYtc93wB.js.map