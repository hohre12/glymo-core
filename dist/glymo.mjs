import { t as bo } from "./TextRecognizer-kCkagxs4.js";
import { t as Mo } from "./GlyphExtractor-pPO-G6Je.js";
import { a as Mi, i as se, n as ee, r as Ci, t as Li } from "./math-TYtc93wB.js";
import { t as li } from "./HandwritingRecognizer-CfzITxxh.js";
import { r as xi, t as Ei } from "./MorphAnimator-D6tc9isd.js";
var Ti = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports), be = [
  "liquid",
  "hologram",
  "bloom",
  "gpu-particles",
  "dissolve"
], Pi = [
  "neon",
  "aurora",
  "gold",
  "calligraphy",
  "fire"
], dt = {
  neon: {
    color: "#00ffaa",
    minWidth: 3,
    maxWidth: 8,
    glowColor: "rgba(0,255,170,0.7)",
    glowSize: 40,
    particleColor: "rgba(0,255,170,0.6)",
    gradient: ["#00ffaa", "#00ddff"]
  },
  aurora: {
    color: "#a78bfa",
    minWidth: 3,
    maxWidth: 9,
    glowColor: "rgba(167,139,250,0.6)",
    glowSize: 35,
    particleColor: "rgba(167,139,250,0.5)",
    gradient: [
      "#a78bfa",
      "#60a5fa",
      "#34d399"
    ]
  },
  gold: {
    color: "#ffd700",
    minWidth: 3,
    maxWidth: 10,
    glowColor: "rgba(255,215,0,0.5)",
    glowSize: 35,
    particleColor: "rgba(255,215,0,0.5)",
    gradient: [
      "#ffd700",
      "#fff4b8",
      "#ffa500"
    ]
  },
  calligraphy: {
    color: "#e8dcc8",
    minWidth: 2.5,
    maxWidth: 12,
    glowColor: "rgba(232,220,200,0.35)",
    glowSize: 20,
    particleColor: "rgba(232,220,200,0.4)",
    gradient: null
  },
  fire: {
    color: "#ff6b35",
    minWidth: 3,
    maxWidth: 10,
    glowColor: "rgba(255,107,53,0.6)",
    glowSize: 35,
    particleColor: "rgba(255,200,50,0.6)",
    gradient: [
      "#ff6b35",
      "#ffd700",
      "#ff4444"
    ]
  },
  liquid: {
    color: "#00ccff",
    minWidth: 2,
    maxWidth: 6,
    glowColor: "rgba(0, 204, 255, 0.5)",
    glowSize: 30,
    particleColor: "rgba(0, 204, 255, 0.4)",
    gradient: [
      "#00ccff",
      "#0088ff",
      "#00ffcc"
    ]
  },
  hologram: {
    color: "#ff00ff",
    minWidth: 2,
    maxWidth: 5,
    glowColor: "rgba(255, 0, 255, 0.5)",
    glowSize: 35,
    particleColor: "rgba(255, 0, 255, 0.4)",
    gradient: [
      "#ff0000",
      "#00ff00",
      "#0000ff"
    ]
  },
  bloom: {
    color: "#ffffff",
    minWidth: 2,
    maxWidth: 6,
    glowColor: "rgba(255, 255, 255, 0.6)",
    glowSize: 40,
    particleColor: "rgba(255, 255, 200, 0.5)",
    gradient: [
      "#ffffff",
      "#ffddaa",
      "#ffffff"
    ]
  },
  "gpu-particles": {
    color: "#ff8800",
    minWidth: 2,
    maxWidth: 5,
    glowColor: "rgba(255, 136, 0, 0.5)",
    glowSize: 25,
    particleColor: "rgba(255, 200, 50, 0.6)",
    gradient: [
      "#ff8800",
      "#ffcc00",
      "#ff4400"
    ]
  },
  dissolve: {
    color: "#88aaff",
    minWidth: 2,
    maxWidth: 6,
    glowColor: "rgba(136, 170, 255, 0.4)",
    glowSize: 30,
    particleColor: "rgba(136, 170, 255, 0.5)",
    gradient: [
      "#88aaff",
      "#aaccff",
      "#6688ff"
    ]
  }
};
function Ii(t) {
  return _i(t), new Promise((e, i) => {
    try {
      t.toBlob((s) => {
        s ? e(s) : i(/* @__PURE__ */ new Error("canvas.toBlob returned null"));
      }, "image/png");
    } catch (s) {
      i(s instanceof Error ? s : new Error(String(s)));
    }
  });
}
function _i(t) {
  if (t.width <= 0 || t.height <= 0) throw new Error(`Invalid canvas dimensions: ${t.width}x${t.height}`);
}
var Di = /* @__PURE__ */ Ti(((t) => {
  var e = Object.defineProperty, i = (g) => e(g, "__esModule", { value: !0 }), s = (g, v) => {
    for (var b in v) e(g, b, {
      get: v[b],
      enumerable: !0
    });
  };
  i(t), s(t, {
    GIFEncoder: () => st,
    applyPalette: () => I,
    default: () => Ht,
    nearestColor: () => mt,
    nearestColorIndex: () => $,
    nearestColorIndexWithDistance: () => ut,
    prequantize: () => C,
    quantize: () => w,
    snapColorsToPalette: () => O
  });
  var r = {
    signature: "GIF",
    version: "89a",
    trailer: 59,
    extensionIntroducer: 33,
    applicationExtensionLabel: 255,
    graphicControlExtensionLabel: 249,
    imageSeparator: 44,
    signatureSize: 3,
    versionSize: 3,
    globalColorTableFlagMask: 128,
    colorResolutionMask: 112,
    sortFlagMask: 8,
    globalColorTableSizeMask: 7,
    applicationIdentifierSize: 8,
    applicationAuthCodeSize: 3,
    disposalMethodMask: 28,
    userInputFlagMask: 2,
    transparentColorFlagMask: 1,
    localColorTableFlagMask: 128,
    interlaceFlagMask: 64,
    idSortFlagMask: 32,
    localColorTableSizeMask: 7
  };
  function n(g = 256) {
    let v = 0, b = new Uint8Array(g);
    return {
      get buffer() {
        return b.buffer;
      },
      reset() {
        v = 0;
      },
      bytesView() {
        return b.subarray(0, v);
      },
      bytes() {
        return b.slice(0, v);
      },
      writeByte(A) {
        k(v + 1), b[v] = A, v++;
      },
      writeBytes(A, L = 0, x = A.length) {
        k(v + x);
        for (let E = 0; E < x; E++) b[v++] = A[E + L];
      },
      writeBytesView(A, L = 0, x = A.byteLength) {
        k(v + x), b.set(A.subarray(L, L + x), v), v += x;
      }
    };
    function k(A) {
      var L = b.length;
      if (L >= A) return;
      A = Math.max(A, L * (L < 1024 * 1024 ? 2 : 1.125) >>> 0), L != 0 && (A = Math.max(A, 256));
      const x = b;
      b = new Uint8Array(A), v > 0 && b.set(x.subarray(0, v), 0);
    }
  }
  var o = 12, a = 5003, c = [
    0,
    1,
    3,
    7,
    15,
    31,
    63,
    127,
    255,
    511,
    1023,
    2047,
    4095,
    8191,
    16383,
    32767,
    65535
  ];
  function l(g, v, b, k, A = n(512), L = new Uint8Array(256), x = new Int32Array(a), E = new Int32Array(a)) {
    const W = x.length, F = Math.max(2, k);
    L.fill(0), E.fill(0), x.fill(-1);
    let D = 0, T = 0;
    const q = F + 1, J = q;
    let X = !1, Q = J, lt = (1 << Q) - 1;
    const R = 1 << q - 1, At = R + 1;
    let rt = R + 2, Z = 0, ot = b[0], Ct = 0;
    for (let tt = W; tt < 65536; tt *= 2) ++Ct;
    Ct = 8 - Ct, A.writeByte(F), gt(R);
    const it = b.length;
    for (let tt = 1; tt < it; tt++) t: {
      const Lt = b[tt], xt = (Lt << o) + ot;
      let at = Lt << Ct ^ ot;
      if (x[at] === xt) {
        ot = E[at];
        break t;
      }
      const ue = at === 0 ? 1 : W - at;
      for (; x[at] >= 0; )
        if (at -= ue, at < 0 && (at += W), x[at] === xt) {
          ot = E[at];
          break t;
        }
      gt(ot), ot = Lt, rt < 1 << o ? (E[at] = rt++, x[at] = xt) : (x.fill(-1), rt = R + 2, X = !0, gt(R));
    }
    return gt(ot), gt(At), A.writeByte(0), A.bytesView();
    function gt(tt) {
      for (D &= c[T], T > 0 ? D |= tt << T : D = tt, T += Q; T >= 8; )
        L[Z++] = D & 255, Z >= 254 && (A.writeByte(Z), A.writeBytesView(L, 0, Z), Z = 0), D >>= 8, T -= 8;
      if ((rt > lt || X) && (X ? (Q = J, lt = (1 << Q) - 1, X = !1) : (++Q, lt = Q === o ? 1 << Q : (1 << Q) - 1)), tt == At) {
        for (; T > 0; )
          L[Z++] = D & 255, Z >= 254 && (A.writeByte(Z), A.writeBytesView(L, 0, Z), Z = 0), D >>= 8, T -= 8;
        Z > 0 && (A.writeByte(Z), A.writeBytesView(L, 0, Z), Z = 0);
      }
    }
  }
  var h = l;
  function d(g, v, b) {
    return g << 8 & 63488 | v << 2 & 992 | b >> 3;
  }
  function u(g, v, b, k) {
    return g >> 4 | v & 240 | (b & 240) << 4 | (k & 240) << 8;
  }
  function p(g, v, b) {
    return g >> 4 << 8 | v & 240 | b >> 4;
  }
  function f(g, v, b) {
    return g < v ? v : g > b ? b : g;
  }
  function m(g) {
    return g * g;
  }
  function y(g, v, b) {
    var k = 0, A = 1e100;
    const L = g[v], x = L.cnt, E = L.ac, W = L.rc, F = L.gc, D = L.bc;
    for (var T = L.fw; T != 0; T = g[T].fw) {
      const J = g[T], X = J.cnt, Q = x * X / (x + X);
      if (!(Q >= A)) {
        var q = 0;
        b && (q += Q * m(J.ac - E), q >= A) || (q += Q * m(J.rc - W), !(q >= A) && (q += Q * m(J.gc - F), !(q >= A) && (q += Q * m(J.bc - D), !(q >= A) && (A = q, k = T))));
      }
    }
    L.err = A, L.nn = k;
  }
  function S() {
    return {
      ac: 0,
      rc: 0,
      gc: 0,
      bc: 0,
      cnt: 0,
      nn: 0,
      fw: 0,
      bk: 0,
      tm: 0,
      mtm: 0,
      err: 0
    };
  }
  function M(g, v) {
    const b = new Array(v === "rgb444" ? 4096 : 65536), k = g.length;
    if (v === "rgba4444") for (let A = 0; A < k; ++A) {
      const L = g[A], x = L >> 24 & 255, E = L >> 16 & 255, W = L >> 8 & 255, F = L & 255, D = u(F, W, E, x);
      let T = D in b ? b[D] : b[D] = S();
      T.rc += F, T.gc += W, T.bc += E, T.ac += x, T.cnt++;
    }
    else if (v === "rgb444") for (let A = 0; A < k; ++A) {
      const L = g[A], x = L >> 16 & 255, E = L >> 8 & 255, W = L & 255, F = p(W, E, x);
      let D = F in b ? b[F] : b[F] = S();
      D.rc += W, D.gc += E, D.bc += x, D.cnt++;
    }
    else for (let A = 0; A < k; ++A) {
      const L = g[A], x = L >> 16 & 255, E = L >> 8 & 255, W = L & 255, F = d(W, E, x);
      let D = F in b ? b[F] : b[F] = S();
      D.rc += W, D.gc += E, D.bc += x, D.cnt++;
    }
    return b;
  }
  function w(g, v, b = {}) {
    const { format: k = "rgb565", clearAlpha: A = !0, clearAlphaColor: L = 0, clearAlphaThreshold: x = 0, oneBitAlpha: E = !1 } = b;
    if (!g || !g.buffer) throw new Error("quantize() expected RGBA Uint8Array data");
    if (!(g instanceof Uint8Array) && !(g instanceof Uint8ClampedArray)) throw new Error("quantize() expected RGBA Uint8Array data");
    const W = new Uint32Array(g.buffer);
    let F = b.useSqrt !== !1;
    const D = k === "rgba4444", T = M(W, k), q = T.length, J = q - 1, X = new Uint32Array(q + 1);
    for (var Q = 0, R = 0; R < q; ++R) {
      const yt = T[R];
      if (yt != null) {
        var lt = 1 / yt.cnt;
        D && (yt.ac *= lt), yt.rc *= lt, yt.gc *= lt, yt.bc *= lt, T[Q++] = yt;
      }
    }
    m(v) / Q < 0.022 && (F = !1);
    for (var R = 0; R < Q - 1; ++R)
      T[R].fw = R + 1, T[R + 1].bk = R, F && (T[R].cnt = Math.sqrt(T[R].cnt));
    F && (T[R].cnt = Math.sqrt(T[R].cnt));
    var At, rt, Z;
    for (R = 0; R < Q; ++R) {
      y(T, R, !1);
      var ot = T[R].err;
      for (rt = ++X[0]; rt > 1 && (Z = rt >> 1, !(T[At = X[Z]].err <= ot)); rt = Z)
        X[rt] = At;
      X[rt] = R;
    }
    var Ct = Q - v;
    for (R = 0; R < Ct; ) {
      for (var it; ; ) {
        var gt = X[1];
        if (it = T[gt], it.tm >= it.mtm && T[it.nn].mtm <= it.tm) break;
        it.mtm == J ? gt = X[1] = X[X[0]--] : (y(T, gt, !1), it.tm = R);
        var ot = T[gt].err;
        for (rt = 1; (Z = rt + rt) <= X[0] && (Z < X[0] && T[X[Z]].err > T[X[Z + 1]].err && Z++, !(ot <= T[At = X[Z]].err)); rt = Z)
          X[rt] = At;
        X[rt] = gt;
      }
      var tt = T[it.nn], Lt = it.cnt, xt = tt.cnt, lt = 1 / (Lt + xt);
      D && (it.ac = lt * (Lt * it.ac + xt * tt.ac)), it.rc = lt * (Lt * it.rc + xt * tt.rc), it.gc = lt * (Lt * it.gc + xt * tt.gc), it.bc = lt * (Lt * it.bc + xt * tt.bc), it.cnt += tt.cnt, it.mtm = ++R, T[tt.bk].fw = tt.fw, T[tt.fw].bk = tt.bk, tt.mtm = J;
    }
    let at = [];
    var ue = 0;
    for (R = 0; ; ++ue) {
      let fe = f(Math.round(T[R].rc), 0, 255), yt = f(Math.round(T[R].gc), 0, 255), pe = f(Math.round(T[R].bc), 0, 255), Nt = 255;
      D && (Nt = f(Math.round(T[R].ac), 0, 255), E && (Nt = Nt <= (typeof E == "number" ? E : 127) ? 0 : 255), A && Nt <= x && (fe = yt = pe = L, Nt = 0));
      const De = D ? [
        fe,
        yt,
        pe,
        Nt
      ] : [
        fe,
        yt,
        pe
      ];
      if (_(at, De) || at.push(De), (R = T[R].fw) == 0) break;
    }
    return at;
  }
  function _(g, v) {
    for (let b = 0; b < g.length; b++) {
      const k = g[b];
      let A = k[0] === v[0] && k[1] === v[1] && k[2] === v[2], L = k.length >= 4 && v.length >= 4 ? k[3] === v[3] : !0;
      if (A && L) return !0;
    }
    return !1;
  }
  function N(g, v) {
    var b = 0, k;
    for (k = 0; k < g.length; k++) {
      const A = g[k] - v[k];
      b += A * A;
    }
    return b;
  }
  function z(g, v) {
    return v > 1 ? Math.round(g / v) * v : g;
  }
  function C(g, { roundRGB: v = 5, roundAlpha: b = 10, oneBitAlpha: k = null } = {}) {
    const A = new Uint32Array(g.buffer);
    for (let L = 0; L < A.length; L++) {
      const x = A[L];
      let E = x >> 24 & 255, W = x >> 16 & 255, F = x >> 8 & 255, D = x & 255;
      E = z(E, b), k && (E = E <= (typeof k == "number" ? k : 127) ? 0 : 255), D = z(D, v), F = z(F, v), W = z(W, v), A[L] = E << 24 | W << 16 | F << 8 | D << 0;
    }
  }
  function I(g, v, b = "rgb565") {
    if (!g || !g.buffer) throw new Error("quantize() expected RGBA Uint8Array data");
    if (!(g instanceof Uint8Array) && !(g instanceof Uint8ClampedArray)) throw new Error("quantize() expected RGBA Uint8Array data");
    if (v.length > 256) throw new Error("applyPalette() only works with 256 colors or less");
    const k = new Uint32Array(g.buffer), A = k.length, L = b === "rgb444" ? 4096 : 65536, x = new Uint8Array(A), E = new Array(L);
    if (b === "rgba4444") for (let W = 0; W < A; W++) {
      const F = k[W], D = F >> 24 & 255, T = F >> 16 & 255, q = F >> 8 & 255, J = F & 255, X = u(J, q, T, D);
      x[W] = X in E ? E[X] : E[X] = H(J, q, T, D, v);
    }
    else {
      const W = b === "rgb444" ? p : d;
      for (let F = 0; F < A; F++) {
        const D = k[F], T = D >> 16 & 255, q = D >> 8 & 255, J = D & 255, X = W(J, q, T);
        x[F] = X in E ? E[X] : E[X] = B(J, q, T, v);
      }
    }
    return x;
  }
  function H(g, v, b, k, A) {
    let L = 0, x = 1e100;
    for (let E = 0; E < A.length; E++) {
      const W = A[E], F = W[3];
      let D = Y(F - k);
      if (D > x) continue;
      const T = W[0];
      if (D += Y(T - g), D > x) continue;
      const q = W[1];
      if (D += Y(q - v), D > x) continue;
      const J = W[2];
      D += Y(J - b), !(D > x) && (x = D, L = E);
    }
    return L;
  }
  function B(g, v, b, k) {
    let A = 0, L = 1e100;
    for (let x = 0; x < k.length; x++) {
      const E = k[x], W = E[0];
      let F = Y(W - g);
      if (F > L) continue;
      const D = E[1];
      if (F += Y(D - v), F > L) continue;
      const T = E[2];
      F += Y(T - b), !(F > L) && (L = F, A = x);
    }
    return A;
  }
  function O(g, v, b = 5) {
    if (!g.length || !v.length) return;
    const k = g.map((x) => x.slice(0, 3)), A = b * b, L = g[0].length;
    for (let x = 0; x < v.length; x++) {
      let E = v[x];
      E.length < L ? E = [
        E[0],
        E[1],
        E[2],
        255
      ] : E.length > L ? E = E.slice(0, 3) : E = E.slice();
      const W = ut(k, E.slice(0, 3), N), F = W[0], D = W[1];
      D > 0 && D <= A && (g[F] = E);
    }
  }
  function Y(g) {
    return g * g;
  }
  function $(g, v, b = N) {
    let k = 1 / 0, A = -1;
    for (let L = 0; L < g.length; L++) {
      const x = g[L], E = b(v, x);
      E < k && (k = E, A = L);
    }
    return A;
  }
  function ut(g, v, b = N) {
    let k = 1 / 0, A = -1;
    for (let L = 0; L < g.length; L++) {
      const x = g[L], E = b(v, x);
      E < k && (k = E, A = L);
    }
    return [A, k];
  }
  function mt(g, v, b = N) {
    return g[$(g, v, b)];
  }
  function st(g = {}) {
    const { initialCapacity: v = 4096, auto: b = !0 } = g, k = n(v), A = 5003, L = new Uint8Array(256), x = new Int32Array(A), E = new Int32Array(A);
    let W = !1;
    return {
      reset() {
        k.reset(), W = !1;
      },
      finish() {
        k.writeByte(r.trailer);
      },
      bytes() {
        return k.bytes();
      },
      bytesView() {
        return k.bytesView();
      },
      get buffer() {
        return k.buffer;
      },
      get stream() {
        return k;
      },
      writeHeader: F,
      writeFrame(D, T, q, J = {}) {
        const { transparent: X = !1, transparentIndex: Q = 0, delay: lt = 0, palette: R = null, repeat: At = 0, colorDepth: rt = 8, dispose: Z = -1 } = J;
        let ot = !1;
        if (b ? W || (ot = !0, F(), W = !0) : ot = !!J.first, T = Math.max(0, Math.floor(T)), q = Math.max(0, Math.floor(q)), ot) {
          if (!R) throw new Error("First frame must include a { palette } option");
          U(k, T, q, R, rt), K(k, R), At >= 0 && j(k, At);
        }
        P(k, Z, Math.round(lt / 10), X, Q);
        const Ct = !!R && !ot;
        G(k, T, q, Ct ? R : null), Ct && K(k, R), ft(k, D, T, q, rt, L, x, E);
      }
    };
    function F() {
      pt(k, "GIF89a");
    }
  }
  function P(g, v, b, k, A) {
    g.writeByte(33), g.writeByte(249), g.writeByte(4), A < 0 && (A = 0, k = !1);
    var L, x;
    k ? (L = 1, x = 2) : (L = 0, x = 0), v >= 0 && (x = v & 7), x <<= 2, g.writeByte(x | 0 | L), nt(g, b), g.writeByte(A || 0), g.writeByte(0);
  }
  function U(g, v, b, k, A = 8) {
    const L = wt(k.length) - 1, x = A - 1 << 4 | 128 | L, E = 0, W = 0;
    nt(g, v), nt(g, b), g.writeBytes([
      x,
      E,
      W
    ]);
  }
  function j(g, v) {
    g.writeByte(33), g.writeByte(255), g.writeByte(11), pt(g, "NETSCAPE2.0"), g.writeByte(3), g.writeByte(1), nt(g, v), g.writeByte(0);
  }
  function K(g, v) {
    const b = 1 << wt(v.length);
    for (let k = 0; k < b; k++) {
      let A = [
        0,
        0,
        0
      ];
      k < v.length && (A = v[k]), g.writeByte(A[0]), g.writeByte(A[1]), g.writeByte(A[2]);
    }
  }
  function G(g, v, b, k) {
    if (g.writeByte(44), nt(g, 0), nt(g, 0), nt(g, v), nt(g, b), k) {
      const A = wt(k.length) - 1;
      g.writeByte(128 | A);
    } else g.writeByte(0);
  }
  function ft(g, v, b, k, A = 8, L, x, E) {
    h(b, k, v, A, g, L, x, E);
  }
  function nt(g, v) {
    g.writeByte(v & 255), g.writeByte(v >> 8 & 255);
  }
  function pt(g, v) {
    for (var b = 0; b < v.length; b++) g.writeByte(v.charCodeAt(b));
  }
  function wt(g) {
    return Math.max(Math.ceil(Math.log2(g)), 1);
  }
  var Ht = st;
})), me = Di(), Eo = 20, To = 2e3, Po = 40, Io = 5e6;
function Ni(t, e) {
  const i = t.getContext("2d");
  if (!i) return Promise.reject(/* @__PURE__ */ new Error("Cannot get 2D context — GIF export requires a browser"));
  Oi(t);
  const s = e?.fps ?? 20, r = e?.durationMs ?? 2e3, n = e?.maxFrames ?? 40, o = e?.onProgress, a = e?.replay;
  return Fi(t, i, Math.min(Math.floor(r / 1e3 * s), n), Math.round(1e3 / s), o, a);
}
async function Fi(t, e, i, s, r, n) {
  const { width: o, height: a } = t, c = (0, me.GIFEncoder)();
  try {
    for (let h = 0; h < i; h++) {
      n ? n(h, i) : await Bi();
      const { data: d } = e.getImageData(0, 0, o, a), u = (0, me.quantize)(d, 256), p = (0, me.applyPalette)(d, u);
      c.writeFrame(p, o, a, {
        palette: u,
        delay: s
      }), r && r(Math.round((h + 1) / i * 100));
    }
    c.finish();
  } catch (h) {
    try {
      c.finish();
    } catch {
    }
    throw h;
  }
  const l = c.bytes();
  return new Blob([l.buffer], { type: "image/gif" });
}
function Bi() {
  return new Promise((t) => requestAnimationFrame(() => t()));
}
function Oi(t) {
  if (t.width <= 0 || t.height <= 0) throw new Error(`Invalid canvas dimensions: ${t.width}x${t.height}`);
}
var _o = 60, Do = 12, No = 10, Ri = class {
  frameTimes = [];
  frameStart = 0;
  consecutiveDegraded = 0;
  startFrame() {
    this.frameStart = performance.now();
  }
  endFrame() {
    const t = performance.now() - this.frameStart;
    this.frameTimes.push(t), this.frameTimes.length > 60 && this.frameTimes.shift(), this.updateDegradation(t);
  }
  getAverageFrameTime() {
    return this.frameTimes.length === 0 ? 0 : this.frameTimes.reduce((t, e) => t + e, 0) / this.frameTimes.length;
  }
  getMaxFrameTime() {
    return this.frameTimes.length === 0 ? 0 : Math.max(...this.frameTimes);
  }
  isPerformanceDegraded() {
    return this.consecutiveDegraded >= 10;
  }
  reset() {
    this.frameTimes = [], this.frameStart = 0, this.consecutiveDegraded = 0;
  }
  updateDegradation(t) {
    t > 12 ? this.consecutiveDegraded++ : this.consecutiveDegraded = 0;
  }
}, Wi = {
  enabled: !1,
  font: "72px sans-serif",
  language: "eng+kor",
  confidenceThreshold: 0.6,
  maxChars: 20,
  glyphPointCount: 300,
  typographyMode: "overlay"
}, zi = {
  mode: "linear",
  fontSize: 16
};
function ge(t, e) {
  const i = Math.min(t.x, e.x), s = Math.min(t.y, e.y), r = Math.max(t.x + t.width, e.x + e.width), n = Math.max(t.y + t.height, e.y + e.height);
  return {
    x: i,
    y: s,
    width: r - i,
    height: n - s
  };
}
function Ui(t, e, i) {
  const s = e.x - i, r = e.y - i, n = e.width + i * 2, o = e.height + i * 2;
  return !(t.x + t.width < s || t.x > s + n || t.y + t.height < r || t.y > r + o);
}
var Hi = class {
  groups = [];
  idCounter = 0;
  destroyed = !1;
  opts;
  constructor(t) {
    this.opts = t;
  }
  setParams(t) {
    this.opts.proximityFactor = t.proximityFactor, this.opts.minProximityPx = t.minProximityPx, this.opts.maxProximityPx = t.maxProximityPx, this.opts.finalizeDelay = t.finalizeDelay;
    for (const e of this.groups) !e.finalized && e.finalizeTimer && this.scheduleFinalizeTimer(e);
  }
  notifyStrokeStart() {
    if (this.destroyed) return;
    const t = performance.now();
    for (const e of this.groups) if (!e.finalized) {
      const i = t - e.lastStrokeEndMs;
      this.opts.finalizeDelay > 0 && i >= this.opts.finalizeDelay ? this.doFinalize(e) : (e.finalizeTimer && (clearTimeout(e.finalizeTimer), e.finalizeTimer = null), e.lastStrokeEndMs = t);
    }
  }
  feedStroke(t, e = 1) {
    if (this.destroyed) return;
    const i = {
      x: t.bbox.x / e,
      y: t.bbox.y / e,
      width: t.bbox.width / e,
      height: t.bbox.height / e
    }, s = {
      id: t.id,
      raw: t.raw,
      bbox: i
    }, r = this.lastActiveGroup();
    if (r) {
      const o = Math.min(Math.max(Math.max(r.bbox.width, r.bbox.height) * this.opts.proximityFactor, this.opts.minProximityPx), this.opts.maxProximityPx);
      if (Ui(i, r.bbox, o)) {
        r.strokes.push(s), r.bbox = ge(r.bbox, i), r.lastStrokeEndMs = performance.now(), r.finalizeTimer && (clearTimeout(r.finalizeTimer), r.finalizeTimer = null), this.opts.onGroupUpdated?.(r), this.scheduleFinalizeTimer(r);
        return;
      }
      this.doFinalize(r);
    }
    const n = {
      id: ++this.idCounter,
      strokes: [s],
      bbox: { ...i },
      finalized: !1,
      finalizeTimer: null,
      lastStrokeEndMs: performance.now()
    };
    this.groups.push(n), this.opts.onGroupUpdated?.(n), this.scheduleFinalizeTimer(n);
  }
  splitGroup(t, e) {
    const i = this.groups.find((r) => r.id === t && !r.finalized);
    if (!i || e <= 0 || e >= i.strokes.length) return null;
    const s = i.strokes.splice(e);
    i.bbox = { ...i.strokes[0].bbox };
    for (let r = 1; r < i.strokes.length; r++) i.bbox = ge(i.bbox, i.strokes[r].bbox);
    return this.doFinalize(i), s;
  }
  createGroup(t) {
    if (this.destroyed || t.length === 0) return;
    const e = this.lastActiveGroup();
    e && this.doFinalize(e);
    let i = { ...t[0].bbox };
    for (let r = 1; r < t.length; r++) i = ge(i, t[r].bbox);
    const s = {
      id: ++this.idCounter,
      strokes: [...t],
      bbox: i,
      finalized: !1,
      finalizeTimer: null,
      lastStrokeEndMs: performance.now()
    };
    this.groups.push(s), this.opts.onGroupUpdated?.(s), this.scheduleFinalizeTimer(s);
  }
  finalizeGroupById(t) {
    const e = this.groups.find((i) => i.id === t && !i.finalized);
    e && this.doFinalize(e);
  }
  flushAll() {
    if (!this.destroyed)
      for (const t of [...this.groups]) t.finalized || this.doFinalize(t);
  }
  clear() {
    for (const t of this.groups) t.finalizeTimer && clearTimeout(t.finalizeTimer);
    this.groups = [];
  }
  destroy() {
    this.destroyed = !0, this.clear();
  }
  get activeGroupCount() {
    return this.groups.filter((t) => !t.finalized).length;
  }
  getActiveGroupId() {
    return this.lastActiveGroup()?.id;
  }
  getActiveGroupLastStrokeMs() {
    return this.lastActiveGroup()?.lastStrokeEndMs ?? 0;
  }
  lastActiveGroup() {
    const t = this.groups[this.groups.length - 1];
    return t && !t.finalized ? t : void 0;
  }
  scheduleFinalizeTimer(t) {
    t.finalizeTimer && clearTimeout(t.finalizeTimer), t.finalizeTimer = setTimeout(() => {
      t.finalizeTimer = null, this.doFinalize(t);
    }, this.opts.finalizeDelay);
  }
  doFinalize(t) {
    t.finalized || (t.finalized = !0, t.finalizeTimer && (clearTimeout(t.finalizeTimer), t.finalizeTimer = null), this.opts.onGroupFinalized(t), this.groups = this.groups.filter((e) => e !== t));
  }
};
function Gi(t, e, i) {
  return t.push(e), t.length > i && t.shift(), t.reduce((s, r) => s + r, 0) / t.length;
}
var ie = {
  en: {
    proximityFactor: 0.8,
    minProximityPx: 40,
    maxProximityPx: 300,
    finalizeDelay: 1200
  },
  ko: {
    proximityFactor: 1,
    minProximityPx: 60,
    maxProximityPx: 300,
    finalizeDelay: 1500
  }
}, ye = ie.en, Fo = class {
  opts;
  idCounter = 0;
  destroyed = !1;
  inflight = 0;
  grouper;
  groupState = /* @__PURE__ */ new Map();
  heightWindow = [];
  chars = /* @__PURE__ */ new Map();
  groupDpr = /* @__PURE__ */ new Map();
  language = "en";
  constructor(t) {
    this.opts = {
      onChar: t.onChar,
      onCorrection: t.onCorrection,
      onRecognizing: t.onRecognizing ?? (() => {
      }),
      onDisplayFlush: t.onDisplayFlush ?? (() => {
      }),
      caseMode: t.caseMode ?? "upper",
      heightWindowSize: t.heightWindowSize ?? 5
    };
    const e = ie[this.language] ?? ye;
    this.grouper = new Hi({
      proximityFactor: e.proximityFactor,
      minProximityPx: e.minProximityPx,
      maxProximityPx: e.maxProximityPx,
      finalizeDelay: e.finalizeDelay,
      onGroupUpdated: (i) => this.handleGroupUpdated(i),
      onGroupFinalized: (i) => this.handleGroupFinalized(i)
    });
  }
  setCaseMode(t) {
    this.opts.caseMode = t;
  }
  setLanguage(t) {
    this.language = t;
    const e = ie[t] ?? ye;
    this.grouper.setParams(e);
  }
  notifyStrokeStart() {
    const t = this.grouper.getActiveGroupId();
    if (t != null && this.groupState.get(t)?.result) {
      const e = this.grouper.getActiveGroupLastStrokeMs();
      if (performance.now() - e >= (ie[this.language] ?? ye).finalizeDelay * 0.5) {
        this.grouper.finalizeGroupById(t);
        return;
      }
    }
    this.grouper.notifyStrokeStart();
  }
  feedStroke(t, e, i = 1, s) {
    if (this.destroyed) return;
    const r = {
      id: s ?? `stroke-${++this.idCounter}`,
      raw: t,
      bbox: e
    };
    this._currentDpr = i, this.grouper.feedStroke(r, i);
  }
  _currentDpr = 1;
  handleGroupUpdated(t) {
    const e = this._currentDpr;
    this.groupDpr.set(t.id, e);
    let i = this.groupState.get(t.id);
    i || (i = {
      generation: 0,
      result: "",
      displayed: !1,
      lastSingleCharStrokeCount: 0,
      lastResult: "",
      stableCount: 0,
      earlyCommitted: !1
    }, this.groupState.set(t.id, i)), this.recognizeGroup(t, i, e);
  }
  handleGroupFinalized(t) {
    const e = this.groupDpr.get(t.id) ?? 1;
    let i = this.groupState.get(t.id);
    i || (i = {
      generation: 0,
      result: "",
      displayed: !1,
      lastSingleCharStrokeCount: 0,
      lastResult: "",
      stableCount: 0,
      earlyCommitted: !1
    }, this.groupState.set(t.id, i)), this.finalizeGroup(t, i, e);
  }
  recognizeGroup(t, e, i) {
    const s = ++e.generation, r = t.strokes.length, n = t.strokes.map((o) => o.raw);
    this.inflight++, this.opts.onRecognizing(!0), li(n, this.language).then((o) => {
      if (this.destroyed || e.generation !== s || !o?.text?.trim()) return;
      let a = o.text.trim().replace(/\s+/g, "");
      if (this.opts.caseMode === "upper" ? a = a.toUpperCase() : this.opts.caseMode === "lower" && (a = a.toLowerCase()), a.length > 1 && e.lastSingleCharStrokeCount > 0) {
        const c = e.lastSingleCharStrokeCount;
        e.result = a[0] ?? "";
        const l = this.grouper.splitGroup(t.id, c);
        l && l.length > 0 && this.grouper.createGroup(l);
      } else {
        const c = a[0] ?? "";
        e.result = c, a.length === 1 && (e.lastSingleCharStrokeCount = r), a.length === 1 && c === e.lastResult && c !== "" ? e.stableCount += 1 : e.stableCount = a.length === 1 ? 1 : 0, e.lastResult = c, e.stableCount >= 2 && a.length === 1 && !e.displayed && !e.earlyCommitted && r >= 2 && (e.earlyCommitted = !0, this.opts.onRecognizing(!1), this.grouper.finalizeGroupById(t.id));
      }
    }).catch(() => {
    }).finally(() => {
      this.inflight--, this.inflight === 0 && this.opts.onRecognizing(!1);
    });
  }
  finalizeGroup(t, e, i) {
    if (e.displayed || (e.displayed = !0, !e.result)) return;
    this.opts.onDisplayFlush(t.strokes.map((l) => l.id));
    const s = Gi(this.heightWindow, t.bbox.height, this.opts.heightWindowSize), r = `char-${++this.idCounter}`, n = t.bbox.x + t.bbox.width / 2, o = t.bbox.y + t.bbox.height / 2, a = t.strokes.flatMap((l) => l.raw.map((h) => ({
      x: h.x / i - n,
      y: h.y / i - o
    }))), c = {
      id: r,
      char: e.result,
      x: n,
      y: o,
      width: t.bbox.width,
      height: s,
      confidence: 0.8,
      strokeIndex: t.id - 1,
      strokePoints: a
    };
    this.chars.set(r, c), this.opts.onChar(c), this.groupState.delete(t.id), this.groupDpr.delete(t.id);
  }
  removeChar(t) {
    this.chars.delete(t);
  }
  undo() {
    const t = [...this.chars.keys()].pop();
    if (t)
      return this.chars.delete(t), t;
  }
  clear() {
    this.grouper.clear(), this.groupState.clear(), this.groupDpr.clear(), this.heightWindow = [], this.chars.clear();
  }
  get charCount() {
    return this.chars.size;
  }
  destroy() {
    this.destroyed = !0, this.grouper.destroy(), this.groupState.clear(), this.groupDpr.clear(), this.heightWindow = [], this.chars.clear();
  }
}, ji = [
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "S",
  "B",
  "S",
  "WS",
  "B",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "B",
  "B",
  "B",
  "S",
  "WS",
  "ON",
  "ON",
  "ET",
  "ET",
  "ET",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "CS",
  "ON",
  "CS",
  "ON",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "B",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "CS",
  "ON",
  "ET",
  "ET",
  "ET",
  "ET",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ET",
  "ET",
  "EN",
  "EN",
  "ON",
  "L",
  "ON",
  "ON",
  "ON",
  "EN",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L"
], Xi = [
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "CS",
  "AL",
  "ON",
  "ON",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AN",
  "AN",
  "AN",
  "AN",
  "AN",
  "AN",
  "AN",
  "AN",
  "AN",
  "AN",
  "ET",
  "AN",
  "AN",
  "AL",
  "AL",
  "AL",
  "NSM",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "ON",
  "NSM",
  "NSM",
  "NSM",
  "NSM",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL",
  "AL"
];
function Vi(t) {
  return t <= 255 ? ji[t] : 1424 <= t && t <= 1524 ? "R" : 1536 <= t && t <= 1791 ? Xi[t & 255] : 1792 <= t && t <= 2220 ? "AL" : "L";
}
function $i(t) {
  const e = t.length;
  if (e === 0) return null;
  const i = new Array(e);
  let s = 0;
  for (let l = 0; l < e; l++) {
    const h = Vi(t.charCodeAt(l));
    (h === "R" || h === "AL" || h === "AN") && s++, i[l] = h;
  }
  if (s === 0) return null;
  const r = e / s < 0.3 ? 0 : 1, n = new Int8Array(e);
  for (let l = 0; l < e; l++) n[l] = r;
  const o = r & 1 ? "R" : "L", a = o;
  let c = a;
  for (let l = 0; l < e; l++) i[l] === "NSM" ? i[l] = c : c = i[l];
  c = a;
  for (let l = 0; l < e; l++) {
    const h = i[l];
    h === "EN" ? i[l] = c === "AL" ? "AN" : "EN" : (h === "R" || h === "L" || h === "AL") && (c = h);
  }
  for (let l = 0; l < e; l++) i[l] === "AL" && (i[l] = "R");
  for (let l = 1; l < e - 1; l++)
    i[l] === "ES" && i[l - 1] === "EN" && i[l + 1] === "EN" && (i[l] = "EN"), i[l] === "CS" && (i[l - 1] === "EN" || i[l - 1] === "AN") && i[l + 1] === i[l - 1] && (i[l] = i[l - 1]);
  for (let l = 0; l < e; l++) {
    if (i[l] !== "EN") continue;
    let h;
    for (h = l - 1; h >= 0 && i[h] === "ET"; h--) i[h] = "EN";
    for (h = l + 1; h < e && i[h] === "ET"; h++) i[h] = "EN";
  }
  for (let l = 0; l < e; l++) {
    const h = i[l];
    (h === "WS" || h === "ES" || h === "ET" || h === "CS") && (i[l] = "ON");
  }
  c = a;
  for (let l = 0; l < e; l++) {
    const h = i[l];
    h === "EN" ? i[l] = c === "L" ? "L" : "EN" : (h === "R" || h === "L") && (c = h);
  }
  for (let l = 0; l < e; l++) {
    if (i[l] !== "ON") continue;
    let h = l + 1;
    for (; h < e && i[h] === "ON"; ) h++;
    const d = l > 0 ? i[l - 1] : a, u = h < e ? i[h] : a, p = d !== "L" ? "R" : "L";
    if (p === (u !== "L" ? "R" : "L")) for (let f = l; f < h; f++) i[f] = p;
    l = h - 1;
  }
  for (let l = 0; l < e; l++) i[l] === "ON" && (i[l] = o);
  for (let l = 0; l < e; l++) {
    const h = i[l];
    (n[l] & 1) === 0 ? h === "R" ? n[l]++ : (h === "AN" || h === "EN") && (n[l] += 2) : (h === "L" || h === "AN" || h === "EN") && n[l]++;
  }
  return n;
}
function qi(t, e) {
  const i = $i(t);
  if (i === null) return null;
  const s = new Int8Array(e.length);
  for (let r = 0; r < e.length; r++) s[r] = i[e[r]];
  return s;
}
var Yi = /[ \t\n\r\f]+/g, Zi = /[\t\n\r\f]| {2,}|^ | $/;
function Ki(t) {
  const e = t ?? "normal";
  return e === "pre-wrap" ? {
    mode: e,
    preserveOrdinarySpaces: !0,
    preserveHardBreaks: !0
  } : {
    mode: e,
    preserveOrdinarySpaces: !1,
    preserveHardBreaks: !1
  };
}
function Ji(t) {
  if (!Zi.test(t)) return t;
  let e = t.replace(Yi, " ");
  return e.charCodeAt(0) === 32 && (e = e.slice(1)), e.length > 0 && e.charCodeAt(e.length - 1) === 32 && (e = e.slice(0, -1)), e;
}
function Qi(t) {
  return /[\r\f]/.test(t) ? t.replace(/\r\n/g, `
`).replace(/[\r\f]/g, `
`) : t.replace(/\r\n/g, `
`);
}
var Se = null, ts;
function es() {
  return Se === null && (Se = new Intl.Segmenter(ts, { granularity: "word" })), Se;
}
var is = /\p{Script=Arabic}/u, ce = /\p{M}/u, ci = /\p{Nd}/u;
function ke(t) {
  return is.test(t);
}
function _t(t) {
  for (const e of t) {
    const i = e.codePointAt(0);
    if (i >= 19968 && i <= 40959 || i >= 13312 && i <= 19903 || i >= 131072 && i <= 173791 || i >= 173824 && i <= 177983 || i >= 177984 && i <= 178207 || i >= 178208 && i <= 183983 || i >= 183984 && i <= 191471 || i >= 196608 && i <= 201551 || i >= 63744 && i <= 64255 || i >= 194560 && i <= 195103 || i >= 12288 && i <= 12351 || i >= 12352 && i <= 12447 || i >= 12448 && i <= 12543 || i >= 44032 && i <= 55215 || i >= 65280 && i <= 65519) return !0;
  }
  return !1;
}
var hi = /* @__PURE__ */ new Set([
  "，",
  "．",
  "！",
  "：",
  "；",
  "？",
  "、",
  "。",
  "・",
  "）",
  "〕",
  "〉",
  "》",
  "」",
  "』",
  "】",
  "〗",
  "〙",
  "〛",
  "ー",
  "々",
  "〻",
  "ゝ",
  "ゞ",
  "ヽ",
  "ヾ"
]), he = /* @__PURE__ */ new Set([
  '"',
  "(",
  "[",
  "{",
  "“",
  "‘",
  "«",
  "‹",
  "（",
  "〔",
  "〈",
  "《",
  "「",
  "『",
  "【",
  "〖",
  "〘",
  "〚"
]), Te = /* @__PURE__ */ new Set(["'", "’"]), $t = /* @__PURE__ */ new Set([
  ".",
  ",",
  "!",
  "?",
  ":",
  ";",
  "،",
  "؛",
  "؟",
  "।",
  "॥",
  "၊",
  "။",
  "၌",
  "၍",
  "၏",
  ")",
  "]",
  "}",
  "%",
  '"',
  "”",
  "’",
  "»",
  "›",
  "…"
]), ss = /* @__PURE__ */ new Set([
  ":",
  ".",
  "،",
  "؛"
]), rs = /* @__PURE__ */ new Set(["၏"]), ns = /* @__PURE__ */ new Set([
  "”",
  "’",
  "»",
  "›",
  "」",
  "』",
  "】",
  "》",
  "〉",
  "〕",
  "）"
]);
function os(t) {
  if (Pe(t)) return !0;
  let e = !1;
  for (const i of t) {
    if ($t.has(i)) {
      e = !0;
      continue;
    }
    if (!(e && ce.test(i)))
      return !1;
  }
  return e;
}
function as(t) {
  for (const e of t) if (!hi.has(e) && !$t.has(e)) return !1;
  return t.length > 0;
}
function ls(t) {
  if (Pe(t)) return !0;
  for (const e of t) if (!he.has(e) && !Te.has(e) && !ce.test(e)) return !1;
  return t.length > 0;
}
function Pe(t) {
  let e = !1;
  for (const i of t)
    if (!(i === "\\" || ce.test(i))) {
      if (he.has(i) || $t.has(i) || Te.has(i)) {
        e = !0;
        continue;
      }
      return !1;
    }
  return e;
}
function cs(t) {
  const e = Array.from(t);
  let i = e.length;
  for (; i > 0; ) {
    const s = e[i - 1];
    if (ce.test(s)) {
      i--;
      continue;
    }
    if (he.has(s) || Te.has(s)) {
      i--;
      continue;
    }
    break;
  }
  return i <= 0 || i === e.length ? null : {
    head: e.slice(0, i).join(""),
    tail: e.slice(i).join("")
  };
}
function hs(t, e) {
  if (t.length === 0) return !1;
  for (const i of t) if (i !== e) return !1;
  return !0;
}
function ds(t) {
  return !ke(t) || t.length === 0 ? !1 : ss.has(t[t.length - 1]);
}
function us(t) {
  return t.length === 0 ? !1 : rs.has(t[t.length - 1]);
}
function fs(t) {
  if (t.length < 2 || t[0] !== " ") return null;
  const e = t.slice(1);
  return /^\p{M}+$/u.test(e) ? {
    space: " ",
    marks: e
  } : null;
}
function di(t) {
  for (let e = t.length - 1; e >= 0; e--) {
    const i = t[e];
    if (ns.has(i)) return !0;
    if (!$t.has(i)) return !1;
  }
  return !1;
}
function ps(t, e) {
  if (e.preserveOrdinarySpaces || e.preserveHardBreaks) {
    if (t === " ") return "preserved-space";
    if (t === "	") return "tab";
    if (e.preserveHardBreaks && t === `
`) return "hard-break";
  }
  return t === " " ? "space" : t === " " || t === " " || t === "⁠" || t === "\uFEFF" ? "glue" : t === "​" ? "zero-width-break" : t === "­" ? "soft-hyphen" : "text";
}
function Et(t) {
  return t.length === 1 ? t[0] : t.join("");
}
function ms(t, e, i, s) {
  const r = [];
  let n = null, o = [], a = i, c = !1, l = 0;
  for (const h of t) {
    const d = ps(h, s), u = d === "text" && e;
    if (n !== null && d === n && u === c) {
      o.push(h), l += h.length;
      continue;
    }
    n !== null && r.push({
      text: Et(o),
      isWordLike: c,
      kind: n,
      start: a
    }), n = d, o = [h], a = i + l, c = u, l += h.length;
  }
  return n !== null && r.push({
    text: Et(o),
    isWordLike: c,
    kind: n,
    start: a
  }), r;
}
function Me(t) {
  return t === "space" || t === "preserved-space" || t === "zero-width-break" || t === "hard-break";
}
var gs = /^[A-Za-z][A-Za-z0-9+.-]*:$/;
function ys(t, e) {
  const i = t.texts[e];
  return i.startsWith("www.") ? !0 : gs.test(i) && e + 1 < t.len && t.kinds[e + 1] === "text" && t.texts[e + 1] === "//";
}
function Ss(t) {
  return t.includes("?") && (t.includes("://") || t.startsWith("www."));
}
function vs(t) {
  const e = t.texts.slice(), i = t.isWordLike.slice(), s = t.kinds.slice(), r = t.starts.slice();
  for (let o = 0; o < t.len; o++) {
    if (s[o] !== "text" || !ys(t, o)) continue;
    const a = [e[o]];
    let c = o + 1;
    for (; c < t.len && !Me(s[c]); ) {
      a.push(e[c]), i[o] = !0;
      const l = e[c].includes("?");
      if (s[c] = "text", e[c] = "", c++, l) break;
    }
    e[o] = Et(a);
  }
  let n = 0;
  for (let o = 0; o < e.length; o++) {
    const a = e[o];
    a.length !== 0 && (n !== o && (e[n] = a, i[n] = i[o], s[n] = s[o], r[n] = r[o]), n++);
  }
  return e.length = n, i.length = n, s.length = n, r.length = n, {
    len: n,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
function ws(t) {
  const e = [], i = [], s = [], r = [];
  for (let n = 0; n < t.len; n++) {
    const o = t.texts[n];
    if (e.push(o), i.push(t.isWordLike[n]), s.push(t.kinds[n]), r.push(t.starts[n]), !Ss(o)) continue;
    const a = n + 1;
    if (a >= t.len || Me(t.kinds[a])) continue;
    const c = [], l = t.starts[a];
    let h = a;
    for (; h < t.len && !Me(t.kinds[h]); )
      c.push(t.texts[h]), h++;
    c.length > 0 && (e.push(Et(c)), i.push(!0), s.push("text"), r.push(l), n = h - 1);
  }
  return {
    len: e.length,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
var As = /* @__PURE__ */ new Set([
  ":",
  "-",
  "/",
  "×",
  ",",
  ".",
  "+",
  "–",
  "—"
]), Ne = /^[A-Za-z0-9_]+[,:;]*$/, Fe = /[,:;]+$/;
function ui(t) {
  for (const e of t) if (ci.test(e)) return !0;
  return !1;
}
function Ce(t) {
  if (t.length === 0) return !1;
  for (const e of t)
    if (!(ci.test(e) || As.has(e)))
      return !1;
  return !0;
}
function bs(t) {
  const e = [], i = [], s = [], r = [];
  for (let n = 0; n < t.len; n++) {
    const o = t.texts[n], a = t.kinds[n];
    if (a === "text" && Ce(o) && ui(o)) {
      const c = [o];
      let l = n + 1;
      for (; l < t.len && t.kinds[l] === "text" && Ce(t.texts[l]); )
        c.push(t.texts[l]), l++;
      e.push(Et(c)), i.push(!0), s.push("text"), r.push(t.starts[n]), n = l - 1;
      continue;
    }
    e.push(o), i.push(t.isWordLike[n]), s.push(a), r.push(t.starts[n]);
  }
  return {
    len: e.length,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
function ks(t) {
  const e = [], i = [], s = [], r = [];
  for (let n = 0; n < t.len; n++) {
    const o = t.texts[n], a = t.kinds[n], c = t.isWordLike[n];
    if (a === "text" && c && Ne.test(o)) {
      const l = [o];
      let h = Fe.test(o), d = n + 1;
      for (; h && d < t.len && t.kinds[d] === "text" && t.isWordLike[d] && Ne.test(t.texts[d]); ) {
        const u = t.texts[d];
        l.push(u), h = Fe.test(u), d++;
      }
      e.push(Et(l)), i.push(!0), s.push("text"), r.push(t.starts[n]), n = d - 1;
      continue;
    }
    e.push(o), i.push(c), s.push(a), r.push(t.starts[n]);
  }
  return {
    len: e.length,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
function Ms(t) {
  const e = [], i = [], s = [], r = [];
  for (let n = 0; n < t.len; n++) {
    const o = t.texts[n];
    if (t.kinds[n] === "text" && o.includes("-")) {
      const a = o.split("-");
      let c = a.length > 1;
      for (let l = 0; l < a.length; l++) {
        const h = a[l];
        if (!c) break;
        (h.length === 0 || !ui(h) || !Ce(h)) && (c = !1);
      }
      if (c) {
        let l = 0;
        for (let h = 0; h < a.length; h++) {
          const d = a[h], u = h < a.length - 1 ? `${d}-` : d;
          e.push(u), i.push(!0), s.push("text"), r.push(t.starts[n] + l), l += u.length;
        }
        continue;
      }
    }
    e.push(o), i.push(t.isWordLike[n]), s.push(t.kinds[n]), r.push(t.starts[n]);
  }
  return {
    len: e.length,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
function Cs(t) {
  const e = [], i = [], s = [], r = [];
  let n = 0;
  for (; n < t.len; ) {
    const o = [t.texts[n]];
    let a = t.isWordLike[n], c = t.kinds[n], l = t.starts[n];
    if (c === "glue") {
      const h = [o[0]], d = l;
      for (n++; n < t.len && t.kinds[n] === "glue"; )
        h.push(t.texts[n]), n++;
      const u = Et(h);
      if (n < t.len && t.kinds[n] === "text")
        o[0] = u, o.push(t.texts[n]), a = t.isWordLike[n], c = "text", l = d, n++;
      else {
        e.push(u), i.push(!1), s.push("glue"), r.push(d);
        continue;
      }
    } else n++;
    if (c === "text") for (; n < t.len && t.kinds[n] === "glue"; ) {
      const h = [];
      for (; n < t.len && t.kinds[n] === "glue"; )
        h.push(t.texts[n]), n++;
      const d = Et(h);
      if (n < t.len && t.kinds[n] === "text") {
        o.push(d, t.texts[n]), a = a || t.isWordLike[n], n++;
        continue;
      }
      o.push(d);
    }
    e.push(Et(o)), i.push(a), s.push(c), r.push(l);
  }
  return {
    len: e.length,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
function Ls(t) {
  const e = t.texts.slice(), i = t.isWordLike.slice(), s = t.kinds.slice(), r = t.starts.slice();
  for (let n = 0; n < e.length - 1; n++) {
    if (s[n] !== "text" || s[n + 1] !== "text" || !_t(e[n]) || !_t(e[n + 1])) continue;
    const o = cs(e[n]);
    o !== null && (e[n] = o.head, e[n + 1] = o.tail + e[n + 1], r[n + 1] = r[n] + o.head.length);
  }
  return {
    len: e.length,
    texts: e,
    isWordLike: i,
    kinds: s,
    starts: r
  };
}
function xs(t, e, i) {
  const s = es();
  let r = 0;
  const n = [], o = [], a = [], c = [];
  for (const d of s.segment(t)) for (const u of ms(d.segment, d.isWordLike ?? !1, d.index, i)) {
    const p = u.kind === "text";
    e.carryCJKAfterClosingQuote && p && r > 0 && a[r - 1] === "text" && _t(u.text) && _t(n[r - 1]) && di(n[r - 1]) || p && r > 0 && a[r - 1] === "text" && as(u.text) && _t(n[r - 1]) || p && r > 0 && a[r - 1] === "text" && us(n[r - 1]) ? (n[r - 1] += u.text, o[r - 1] = o[r - 1] || u.isWordLike) : p && r > 0 && a[r - 1] === "text" && u.isWordLike && ke(u.text) && ds(n[r - 1]) ? (n[r - 1] += u.text, o[r - 1] = !0) : p && !u.isWordLike && r > 0 && a[r - 1] === "text" && u.text.length === 1 && u.text !== "-" && u.text !== "—" && hs(n[r - 1], u.text) || p && !u.isWordLike && r > 0 && a[r - 1] === "text" && (os(u.text) || u.text === "-" && o[r - 1]) ? n[r - 1] += u.text : (n[r] = u.text, o[r] = u.isWordLike, a[r] = u.kind, c[r] = u.start, r++);
  }
  for (let d = 1; d < r; d++) a[d] === "text" && !o[d] && Pe(n[d]) && a[d - 1] === "text" && (n[d - 1] += n[d], o[d - 1] = o[d - 1] || o[d], n[d] = "");
  for (let d = r - 2; d >= 0; d--) if (a[d] === "text" && !o[d] && ls(n[d])) {
    let u = d + 1;
    for (; u < r && n[u] === ""; ) u++;
    u < r && a[u] === "text" && (n[u] = n[d] + n[u], c[u] = c[d], n[d] = "");
  }
  let l = 0;
  for (let d = 0; d < r; d++) {
    const u = n[d];
    u.length !== 0 && (l !== d && (n[l] = u, o[l] = o[d], a[l] = a[d], c[l] = c[d]), l++);
  }
  n.length = l, o.length = l, a.length = l, c.length = l;
  const h = Ls(ks(Ms(bs(ws(vs(Cs({
    len: l,
    texts: n,
    isWordLike: o,
    kinds: a,
    starts: c
  })))))));
  for (let d = 0; d < h.len - 1; d++) {
    const u = fs(h.texts[d]);
    u !== null && (h.kinds[d] !== "space" && h.kinds[d] !== "preserved-space" || h.kinds[d + 1] !== "text" || !ke(h.texts[d + 1]) || (h.texts[d] = u.space, h.isWordLike[d] = !1, h.kinds[d] = h.kinds[d] === "preserved-space" ? "preserved-space" : "space", h.texts[d + 1] = u.marks + h.texts[d + 1], h.starts[d + 1] = h.starts[d] + u.space.length));
  }
  return h;
}
function Es(t, e) {
  if (t.len === 0) return [];
  if (!e.preserveHardBreaks) return [{
    startSegmentIndex: 0,
    endSegmentIndex: t.len,
    consumedEndSegmentIndex: t.len
  }];
  const i = [];
  let s = 0;
  for (let r = 0; r < t.len; r++)
    t.kinds[r] === "hard-break" && (i.push({
      startSegmentIndex: s,
      endSegmentIndex: r,
      consumedEndSegmentIndex: r + 1
    }), s = r + 1);
  return s < t.len && i.push({
    startSegmentIndex: s,
    endSegmentIndex: t.len,
    consumedEndSegmentIndex: t.len
  }), i;
}
function Ts(t, e, i = "normal") {
  const s = Ki(i), r = s.mode === "pre-wrap" ? Qi(t) : Ji(t);
  if (r.length === 0) return {
    normalized: r,
    chunks: [],
    len: 0,
    texts: [],
    isWordLike: [],
    kinds: [],
    starts: []
  };
  const n = xs(r, e, s);
  return {
    normalized: r,
    chunks: Es(n, s),
    ...n
  };
}
var Ft = null, Be = /* @__PURE__ */ new Map(), Bt = null, Ps = /\p{Emoji_Presentation}/u, Is = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u, ve = null, Oe = /* @__PURE__ */ new Map();
function Ie() {
  if (Ft !== null) return Ft;
  if (typeof OffscreenCanvas < "u")
    return Ft = new OffscreenCanvas(1, 1).getContext("2d"), Ft;
  if (typeof document < "u")
    return Ft = document.createElement("canvas").getContext("2d"), Ft;
  throw new Error("Text measurement requires OffscreenCanvas or a DOM canvas context.");
}
function _s(t) {
  let e = Be.get(t);
  return e || (e = /* @__PURE__ */ new Map(), Be.set(t, e)), e;
}
function Pt(t, e) {
  let i = e.get(t);
  return i === void 0 && (i = {
    width: Ie().measureText(t).width,
    containsCJK: _t(t)
  }, e.set(t, i)), i;
}
function de() {
  if (Bt !== null) return Bt;
  if (typeof navigator > "u")
    return Bt = {
      lineFitEpsilon: 5e-3,
      carryCJKAfterClosingQuote: !1,
      preferPrefixWidthsForBreakableRuns: !1,
      preferEarlySoftHyphenBreak: !1
    }, Bt;
  const t = navigator.userAgent, e = navigator.vendor === "Apple Computer, Inc." && t.includes("Safari/") && !t.includes("Chrome/") && !t.includes("Chromium/") && !t.includes("CriOS/") && !t.includes("FxiOS/") && !t.includes("EdgiOS/"), i = t.includes("Chrome/") || t.includes("Chromium/") || t.includes("CriOS/") || t.includes("Edg/");
  return Bt = {
    lineFitEpsilon: e ? 1 / 64 : 5e-3,
    carryCJKAfterClosingQuote: i,
    preferPrefixWidthsForBreakableRuns: e,
    preferEarlySoftHyphenBreak: e
  }, Bt;
}
function Ds(t) {
  const e = t.match(/(\d+(?:\.\d+)?)\s*px/);
  return e ? parseFloat(e[1]) : 16;
}
function _e() {
  return ve === null && (ve = new Intl.Segmenter(void 0, { granularity: "grapheme" })), ve;
}
function Ns(t) {
  return Ps.test(t) || t.includes("️");
}
function Fs(t) {
  return Is.test(t);
}
function Bs(t, e) {
  let i = Oe.get(t);
  if (i !== void 0) return i;
  const s = Ie();
  s.font = t;
  const r = s.measureText("😀").width;
  if (i = 0, r > e + 0.5 && typeof document < "u" && document.body !== null) {
    const n = document.createElement("span");
    n.style.font = t, n.style.display = "inline-block", n.style.visibility = "hidden", n.style.position = "absolute", n.textContent = "😀", document.body.appendChild(n);
    const o = n.getBoundingClientRect().width;
    document.body.removeChild(n), r - o > 0.5 && (i = r - o);
  }
  return Oe.set(t, i), i;
}
function Os(t) {
  let e = 0;
  const i = _e();
  for (const s of i.segment(t)) Ns(s.segment) && e++;
  return e;
}
function Rs(t, e) {
  return e.emojiCount === void 0 && (e.emojiCount = Os(t)), e.emojiCount;
}
function It(t, e, i) {
  return i === 0 ? e.width : e.width - Rs(t, e) * i;
}
function Ws(t, e, i, s) {
  if (e.graphemeWidths !== void 0) return e.graphemeWidths;
  const r = [], n = _e();
  for (const o of n.segment(t)) {
    const a = Pt(o.segment, i);
    r.push(It(o.segment, a, s));
  }
  return e.graphemeWidths = r.length > 1 ? r : null, e.graphemeWidths;
}
function zs(t, e, i, s) {
  if (e.graphemePrefixWidths !== void 0) return e.graphemePrefixWidths;
  const r = [], n = _e();
  let o = "";
  for (const a of n.segment(t)) {
    o += a.segment;
    const c = Pt(o, i);
    r.push(It(o, c, s));
  }
  return e.graphemePrefixWidths = r.length > 1 ? r : null, e.graphemePrefixWidths;
}
function Us(t, e) {
  const i = Ie();
  i.font = t;
  const s = _s(t), r = Ds(t);
  return {
    cache: s,
    fontSize: r,
    emojiCorrection: e ? Bs(t, r) : 0
  };
}
function re(t) {
  return t === "space" || t === "preserved-space" || t === "tab" || t === "zero-width-break" || t === "soft-hyphen";
}
function Hs(t, e) {
  if (e <= 0) return 0;
  const i = t % e;
  return Math.abs(i) <= 1e-6 ? e : e - i;
}
function fi(t, e, i, s) {
  return !s || e === null ? t[i] : e[i] - (i > 0 ? e[i - 1] : 0);
}
function Gs(t, e, i, s, r, n) {
  let o = 0, a = e;
  for (; o < t.length; ) {
    const c = n ? e + t[o] : a + t[o];
    if ((o + 1 < t.length ? c + r : c) > i + s) break;
    a = c, o++;
  }
  return {
    fitCount: o,
    fittedWidth: a
  };
}
function js(t, e) {
  let i = 0, s = t.chunks.length;
  for (; i < s; ) {
    const r = Math.floor((i + s) / 2);
    e < t.chunks[r].consumedEndSegmentIndex ? s = r : i = r + 1;
  }
  return i < t.chunks.length ? i : -1;
}
function Xs(t, e) {
  let i = e.segmentIndex;
  const s = e.graphemeIndex;
  if (i >= t.widths.length) return null;
  const r = js(t, i);
  if (r < 0) return null;
  if (s > 0) return {
    cursor: e,
    chunkIndex: r
  };
  const n = t.chunks[r];
  if (n.startSegmentIndex === n.endSegmentIndex && i === n.startSegmentIndex) return {
    cursor: {
      segmentIndex: i,
      graphemeIndex: 0
    },
    chunkIndex: r
  };
  for (i < n.startSegmentIndex && (i = n.startSegmentIndex); i < n.endSegmentIndex; ) {
    const o = t.kinds[i];
    if (o !== "space" && o !== "zero-width-break" && o !== "soft-hyphen") return {
      cursor: {
        segmentIndex: i,
        graphemeIndex: 0
      },
      chunkIndex: r
    };
    i++;
  }
  return n.consumedEndSegmentIndex >= t.widths.length ? null : {
    cursor: {
      segmentIndex: n.consumedEndSegmentIndex,
      graphemeIndex: 0
    },
    chunkIndex: r + 1
  };
}
function Vs(t, e, i) {
  const s = Xs(t, e);
  if (s === null) return null;
  if (t.simpleLineWalkFastPath) return $s(t, s.cursor, i);
  const r = t.chunks[s.chunkIndex];
  if (r.startSegmentIndex === r.endSegmentIndex) return {
    startSegmentIndex: r.startSegmentIndex,
    startGraphemeIndex: 0,
    endSegmentIndex: r.consumedEndSegmentIndex,
    endGraphemeIndex: 0,
    width: 0
  };
  const { widths: n, lineEndFitAdvances: o, lineEndPaintAdvances: a, kinds: c, breakableWidths: l, breakablePrefixWidths: h, discretionaryHyphenWidth: d, tabStopAdvance: u } = t, p = de(), f = p.lineFitEpsilon;
  let m = 0, y = !1;
  const S = s.cursor.segmentIndex, M = s.cursor.graphemeIndex;
  let w = S, _ = M, N = -1, z = 0, C = 0, I = null;
  function H() {
    N = -1, z = 0, C = 0, I = null;
  }
  function B(P = w, U = _, j = m) {
    return y ? {
      startSegmentIndex: S,
      startGraphemeIndex: M,
      endSegmentIndex: P,
      endGraphemeIndex: U,
      width: j
    } : null;
  }
  function O(P, U) {
    y = !0, w = P + 1, _ = 0, m = U;
  }
  function Y(P, U, j) {
    y = !0, w = P, _ = U + 1, m = j;
  }
  function $(P, U) {
    if (!y) {
      O(P, U);
      return;
    }
    m += U, w = P + 1, _ = 0;
  }
  function ut(P, U) {
    if (!re(c[P])) return;
    const j = c[P] === "tab" ? 0 : o[P], K = c[P] === "tab" ? U : a[P];
    N = P + 1, z = m - U + j, C = m - U + K, I = c[P];
  }
  function mt(P, U) {
    const j = l[P], K = h[P] ?? null;
    for (let G = U; G < j.length; G++) {
      const ft = fi(j, K, G, p.preferPrefixWidthsForBreakableRuns);
      if (!y) {
        Y(P, G, ft);
        continue;
      }
      if (m + ft > i + f) return B();
      m += ft, w = P, _ = G + 1;
    }
    return y && w === P && _ === j.length && (w = P + 1, _ = 0), null;
  }
  function st(P) {
    if (I !== "soft-hyphen" || N < 0) return null;
    const U = l[P] ?? null;
    if (U !== null) {
      const j = p.preferPrefixWidthsForBreakableRuns ? h[P] ?? U : U, { fitCount: K, fittedWidth: G } = Gs(j, m, i, f, d, j !== U);
      if (K === U.length)
        return m = G, w = P + 1, _ = 0, H(), null;
      if (K > 0) return B(P, K, G + d);
    }
    return z <= i + f ? B(N, 0, C) : null;
  }
  for (let P = s.cursor.segmentIndex; P < r.endSegmentIndex; P++) {
    const U = c[P], j = P === s.cursor.segmentIndex ? s.cursor.graphemeIndex : 0, K = U === "tab" ? Hs(m, u) : n[P];
    if (U === "soft-hyphen" && j === 0) {
      y && (w = P + 1, _ = 0, N = P + 1, z = m + d, C = m + d, I = U);
      continue;
    }
    if (!y) {
      if (j > 0) {
        const G = mt(P, j);
        if (G !== null) return G;
      } else if (K > i && l[P] !== null) {
        const G = mt(P, 0);
        if (G !== null) return G;
      } else O(P, K);
      ut(P, K);
      continue;
    }
    if (m + K > i + f) {
      const G = m + (U === "tab" ? 0 : o[P]), ft = m + (U === "tab" ? K : a[P]);
      if (I === "soft-hyphen" && p.preferEarlySoftHyphenBreak && z <= i + f) return B(N, 0, C);
      const nt = st(P);
      if (nt !== null) return nt;
      if (re(U) && G <= i + f)
        return $(P, K), B(P + 1, 0, ft);
      if (N >= 0 && z <= i + f)
        return w > N || w === N && _ > 0 ? B() : B(N, 0, C);
      if (K > i && l[P] !== null) {
        const pt = B();
        if (pt !== null) return pt;
        const wt = mt(P, 0);
        if (wt !== null) return wt;
      }
      return B();
    }
    $(P, K), ut(P, K);
  }
  return N === r.consumedEndSegmentIndex && _ === 0 ? B(r.consumedEndSegmentIndex, 0, C) : B(r.consumedEndSegmentIndex, 0, m);
}
function $s(t, e, i) {
  const { widths: s, kinds: r, breakableWidths: n, breakablePrefixWidths: o } = t, a = de(), c = a.lineFitEpsilon;
  let l = 0, h = !1;
  const d = e.segmentIndex, u = e.graphemeIndex;
  let p = d, f = u, m = -1, y = 0;
  function S(C = p, I = f, H = l) {
    return h ? {
      startSegmentIndex: d,
      startGraphemeIndex: u,
      endSegmentIndex: C,
      endGraphemeIndex: I,
      width: H
    } : null;
  }
  function M(C, I) {
    h = !0, p = C + 1, f = 0, l = I;
  }
  function w(C, I, H) {
    h = !0, p = C, f = I + 1, l = H;
  }
  function _(C, I) {
    if (!h) {
      M(C, I);
      return;
    }
    l += I, p = C + 1, f = 0;
  }
  function N(C, I) {
    re(r[C]) && (m = C + 1, y = l - I);
  }
  function z(C, I) {
    const H = n[C], B = o[C] ?? null;
    for (let O = I; O < H.length; O++) {
      const Y = fi(H, B, O, a.preferPrefixWidthsForBreakableRuns);
      if (!h) {
        w(C, O, Y);
        continue;
      }
      if (l + Y > i + c) return S();
      l += Y, p = C, f = O + 1;
    }
    return h && p === C && f === H.length && (p = C + 1, f = 0), null;
  }
  for (let C = e.segmentIndex; C < s.length; C++) {
    const I = s[C], H = r[C], B = C === e.segmentIndex ? e.graphemeIndex : 0;
    if (!h) {
      if (B > 0) {
        const O = z(C, B);
        if (O !== null) return O;
      } else if (I > i && n[C] !== null) {
        const O = z(C, 0);
        if (O !== null) return O;
      } else M(C, I);
      N(C, I);
      continue;
    }
    if (l + I > i + c) {
      if (re(H))
        return _(C, I), S(C + 1, 0, l - I);
      if (m >= 0)
        return p > m || p === m && f > 0 ? S() : S(m, 0, y);
      if (I > i && n[C] !== null) {
        const O = S();
        if (O !== null) return O;
        const Y = z(C, 0);
        if (Y !== null) return Y;
      }
      return S();
    }
    _(C, I), N(C, I);
  }
  return S();
}
var we = null, Re = /* @__PURE__ */ new WeakMap();
function pi() {
  return we === null && (we = new Intl.Segmenter(void 0, { granularity: "grapheme" })), we;
}
function qs(t) {
  return t ? {
    widths: [],
    lineEndFitAdvances: [],
    lineEndPaintAdvances: [],
    kinds: [],
    simpleLineWalkFastPath: !0,
    segLevels: null,
    breakableWidths: [],
    breakablePrefixWidths: [],
    discretionaryHyphenWidth: 0,
    tabStopAdvance: 0,
    chunks: [],
    segments: []
  } : {
    widths: [],
    lineEndFitAdvances: [],
    lineEndPaintAdvances: [],
    kinds: [],
    simpleLineWalkFastPath: !0,
    segLevels: null,
    breakableWidths: [],
    breakablePrefixWidths: [],
    discretionaryHyphenWidth: 0,
    tabStopAdvance: 0,
    chunks: []
  };
}
function Ys(t, e, i) {
  const s = pi(), r = de(), { cache: n, emojiCorrection: o } = Us(e, Fs(t.normalized)), a = It("-", Pt("-", n), o), c = It(" ", Pt(" ", n), o) * 8;
  if (t.len === 0) return qs(i);
  const l = [], h = [], d = [], u = [];
  let p = t.chunks.length <= 1;
  const f = i ? [] : null, m = [], y = [], S = i ? [] : null, M = Array.from({ length: t.len }), w = Array.from({ length: t.len });
  function _(C, I, H, B, O, Y, $, ut) {
    O !== "text" && O !== "space" && O !== "zero-width-break" && (p = !1), l.push(I), h.push(H), d.push(B), u.push(O), f?.push(Y), m.push($), y.push(ut), S !== null && S.push(C);
  }
  for (let C = 0; C < t.len; C++) {
    M[C] = l.length;
    const I = t.texts[C], H = t.isWordLike[C], B = t.kinds[C], O = t.starts[C];
    if (B === "soft-hyphen") {
      _(I, 0, a, a, B, O, null, null), w[C] = l.length;
      continue;
    }
    if (B === "hard-break") {
      _(I, 0, 0, 0, B, O, null, null), w[C] = l.length;
      continue;
    }
    if (B === "tab") {
      _(I, 0, 0, 0, B, O, null, null), w[C] = l.length;
      continue;
    }
    const Y = Pt(I, n);
    if (B === "text" && Y.containsCJK) {
      let st = "", P = 0;
      for (const U of s.segment(I)) {
        const j = U.segment;
        if (st.length === 0) {
          st = j, P = U.index;
          continue;
        }
        if (he.has(st) || hi.has(j) || $t.has(j) || r.carryCJKAfterClosingQuote && _t(j) && di(st)) {
          st += j;
          continue;
        }
        const K = Pt(st, n), G = It(st, K, o);
        _(st, G, G, G, "text", O + P, null, null), st = j, P = U.index;
      }
      if (st.length > 0) {
        const U = Pt(st, n), j = It(st, U, o);
        _(st, j, j, j, "text", O + P, null, null);
      }
      w[C] = l.length;
      continue;
    }
    const $ = It(I, Y, o), ut = B === "space" || B === "preserved-space" || B === "zero-width-break" ? 0 : $, mt = B === "space" || B === "zero-width-break" ? 0 : $;
    H && I.length > 1 ? _(I, $, ut, mt, B, O, Ws(I, Y, n, o), r.preferPrefixWidthsForBreakableRuns ? zs(I, Y, n, o) : null) : _(I, $, ut, mt, B, O, null, null), w[C] = l.length;
  }
  const N = Zs(t.chunks, M, w), z = f === null ? null : qi(t.normalized, f);
  return S !== null ? {
    widths: l,
    lineEndFitAdvances: h,
    lineEndPaintAdvances: d,
    kinds: u,
    simpleLineWalkFastPath: p,
    segLevels: z,
    breakableWidths: m,
    breakablePrefixWidths: y,
    discretionaryHyphenWidth: a,
    tabStopAdvance: c,
    chunks: N,
    segments: S
  } : {
    widths: l,
    lineEndFitAdvances: h,
    lineEndPaintAdvances: d,
    kinds: u,
    simpleLineWalkFastPath: p,
    segLevels: z,
    breakableWidths: m,
    breakablePrefixWidths: y,
    discretionaryHyphenWidth: a,
    tabStopAdvance: c,
    chunks: N
  };
}
function Zs(t, e, i) {
  const s = [];
  for (let r = 0; r < t.length; r++) {
    const n = t[r], o = n.startSegmentIndex < e.length ? e[n.startSegmentIndex] : i[i.length - 1] ?? 0, a = n.endSegmentIndex < e.length ? e[n.endSegmentIndex] : i[i.length - 1] ?? 0, c = n.consumedEndSegmentIndex < e.length ? e[n.consumedEndSegmentIndex] : i[i.length - 1] ?? 0;
    s.push({
      startSegmentIndex: o,
      endSegmentIndex: a,
      consumedEndSegmentIndex: c
    });
  }
  return s;
}
function Ks(t, e, i, s) {
  return Ys(Ts(t, de(), s?.whiteSpace), e, i);
}
function Js(t, e, i) {
  return Ks(t, e, !0, i);
}
function We(t, e, i) {
  let s = i.get(t);
  if (s !== void 0) return s;
  s = [];
  const r = pi();
  for (const n of r.segment(e[t])) s.push(n.segment);
  return i.set(t, s), s;
}
function Qs(t) {
  let e = Re.get(t);
  return e !== void 0 || (e = /* @__PURE__ */ new Map(), Re.set(t, e)), e;
}
function tr(t, e, i, s) {
  return s > 0 && t[s - 1] === "soft-hyphen" && !(e === s && i > 0);
}
function er(t, e, i, s, r, n, o) {
  let a = "";
  const c = tr(e, s, r, n);
  for (let l = s; l < n; l++)
    e[l] === "soft-hyphen" || e[l] === "hard-break" || (l === s && r > 0 ? a += We(l, t, i).slice(r).join("") : a += t[l]);
  return o > 0 ? (c && (a += "-"), a += We(n, t, i).slice(s === n ? r : 0, o).join("")) : c && (a += "-"), a;
}
function ir(t, e, i, s, r, n, o) {
  return {
    text: er(t.segments, t.kinds, e, s, r, n, o),
    width: i,
    start: {
      segmentIndex: s,
      graphemeIndex: r
    },
    end: {
      segmentIndex: n,
      graphemeIndex: o
    }
  };
}
function sr(t) {
  return {
    width: t.width,
    start: {
      segmentIndex: t.startSegmentIndex,
      graphemeIndex: t.startGraphemeIndex
    },
    end: {
      segmentIndex: t.endSegmentIndex,
      graphemeIndex: t.endGraphemeIndex
    }
  };
}
function rr(t, e, i) {
  const s = Vs(t, e, i);
  return s === null ? null : sr(s);
}
function nr(t, e) {
  return ir(t, Qs(t), e.width, e.start.segmentIndex, e.start.graphemeIndex, e.end.segmentIndex, e.end.graphemeIndex);
}
function or(t, e, i) {
  const s = rr(t, e, i);
  return s === null ? null : nr(t, s);
}
var ar = Math.PI * 2, mi = 16, Yt = 4, lr = 1.4;
function cr(t, e, i = mi) {
  if (t.length === 0 || e.length < 2) return [];
  const s = ur(e), r = s[s.length - 1];
  if (r === 0) return [];
  const n = i * 0.6, o = Math.max(n, r / t.length), a = [];
  for (let c = 0; c < t.length; c++) {
    const { point: l, tangentAngle: h } = fr(e, s, o * (c + 0.5));
    a.push({
      char: t[c],
      x: l.x,
      y: l.y,
      rotation: h,
      scale: 1
    });
  }
  return a;
}
function hr(t, e, i, s = 0) {
  if (t.length === 0 || i <= 0) return [];
  const r = ar / t.length, n = [];
  for (let o = 0; o < t.length; o++) {
    const a = s + r * o;
    n.push({
      char: t[o],
      x: e.x + i * Math.cos(a),
      y: e.y + i * Math.sin(a),
      rotation: a + Math.PI / 2,
      scale: 1
    });
  }
  return n;
}
function dr(t, e, i = mi) {
  if (t.length === 0 || e.length < 3) return [];
  const s = pr(e), r = i * lr, n = `${i}px sans-serif`, o = [], a = Js(t, n);
  let c = {
    segmentIndex: 0,
    graphemeIndex: 0
  };
  for (let l = s.minY + Yt + r / 2; l < s.maxY - Yt; l += r) {
    const h = mr(e, l, s);
    if (!h) continue;
    const d = h.maxX - h.minX - Yt * 2;
    if (d < i * 0.5) continue;
    const u = or(a, c, d);
    if (u === null) break;
    const p = h.minX + Yt, f = u.text.length > 0 ? u.width / u.text.length : 0;
    for (let m = 0; m < u.text.length; m++) {
      const y = u.text[m];
      y.trim() !== "" && o.push({
        char: y,
        x: p + f * (m + 0.5),
        y: l,
        rotation: 0,
        scale: 1
      });
    }
    c = u.end;
  }
  return o;
}
function ur(t) {
  const e = [0];
  for (let i = 1; i < t.length; i++) e.push(e[i - 1] + Ci(t[i - 1], t[i]));
  return e;
}
function fr(t, e, i) {
  const s = Math.max(0, Math.min(i, e[e.length - 1]));
  let r = 0, n = e.length - 1;
  for (; r < n - 1; ) {
    const h = r + n >> 1;
    e[h] <= s ? r = h : n = h;
  }
  const o = e[n] - e[r], a = o > 0 ? (s - e[r]) / o : 0, c = t[r], l = t[n];
  return {
    point: {
      x: c.x + (l.x - c.x) * a,
      y: c.y + (l.y - c.y) * a
    },
    tangentAngle: Math.atan2(l.y - c.y, l.x - c.x)
  };
}
function pr(t) {
  let e = 1 / 0, i = 1 / 0, s = -1 / 0, r = -1 / 0;
  for (const n of t)
    n.x < e && (e = n.x), n.y < i && (i = n.y), n.x > s && (s = n.x), n.y > r && (r = n.y);
  return {
    minX: e,
    minY: i,
    maxX: s,
    maxY: r
  };
}
function mr(t, e, i) {
  const s = [], r = t.length;
  for (let n = 0; n < r; n++) {
    const o = t[n], a = t[(n + 1) % r];
    if (o.y <= e && a.y > e || a.y <= e && o.y > e) {
      const c = (e - o.y) / (a.y - o.y);
      s.push(o.x + c * (a.x - o.x));
    }
  }
  return s.length < 2 ? null : (s.sort((n, o) => n - o), {
    minX: Math.max(s[0], i.minX),
    maxX: Math.min(s[s.length - 1], i.maxX)
  });
}
var gr = 30, yr = 0.6, Sr = class {
  layoutMode;
  options;
  positioned = [];
  staggerMs;
  constructor(t, e) {
    this.options = {
      ...zi,
      ...t
    }, this.layoutMode = this.options.mode, this.staggerMs = e ?? gr;
  }
  setLayoutMode(t) {
    this.layoutMode = t, this.options.mode = t;
  }
  getLayoutMode() {
    return this.layoutMode;
  }
  setOptions(t) {
    Object.assign(this.options, t), t.mode !== void 0 && (this.layoutMode = t.mode);
  }
  computeLayout(t, e) {
    const i = this.options.fontSize ?? 16;
    switch (this.layoutMode) {
      case "curve":
        this.positioned = cr(t, e, i);
        break;
      case "circle":
        this.positioned = this.computeCircleLayout(t, e);
        break;
      case "fill":
        this.positioned = dr(t, e, i);
        break;
      default:
        this.positioned = this.computeLinearLayout(t, e, i);
        break;
    }
    return this.positioned;
  }
  relayout(t, e) {
    return this.computeLayout(t, e);
  }
  getPositionedChars() {
    return this.positioned;
  }
  getStaggerDelay(t) {
    return t * this.staggerMs;
  }
  getCharProgress(t, e, i) {
    const s = e - this.getStaggerDelay(t);
    return s <= 0 ? 0 : s >= i ? 1 : s / i;
  }
  getTotalDuration(t, e) {
    return t <= 0 ? 0 : (t - 1) * this.staggerMs + e;
  }
  computeCircleLayout(t, e) {
    if (e.length < 2) return [];
    const i = this.computeCentroid(e);
    return hr(t, i, this.options.radius ?? this.computeAvgRadius(i, e), this.options.startAngle ?? 0);
  }
  computeLinearLayout(t, e, i) {
    if (t.length === 0) return [];
    const s = e.length > 0 ? e[0] : {
      x: 0,
      y: 0
    }, r = i * yr;
    return Array.from(t).map((n, o) => ({
      char: n,
      x: s.x + r * o,
      y: s.y,
      rotation: 0,
      scale: 1
    }));
  }
  computeCentroid(t) {
    let e = 0, i = 0;
    for (const s of t)
      e += s.x, i += s.y;
    return {
      x: e / t.length,
      y: i / t.length
    };
  }
  computeAvgRadius(t, e) {
    let i = 0;
    for (const s of e) {
      const r = s.x - t.x, n = s.y - t.y;
      i += Math.sqrt(r * r + n * n);
    }
    return i / e.length;
  }
}, qt = class {
  destroy() {
  }
}, Bo = 21, Le = 0.045, vr = 0.6, wr = 0.7, Ar = 1.5, Oo = 2, Ro = 2, Ut = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17]
], ze = [
  [
    1,
    2,
    3,
    4
  ],
  [
    5,
    6,
    7,
    8
  ],
  [
    9,
    10,
    11,
    12
  ],
  [
    13,
    14,
    15,
    16
  ],
  [
    17,
    18,
    19,
    20
  ]
], Dt = [
  4,
  8,
  12,
  16,
  20
], et = {
  ACCENT: "rgba(0, 255, 204, ",
  ACCENT_HEX: "#00ffcc",
  ACCENT_DIM: "rgba(0, 255, 204, 0.15)",
  PINCH_ACTIVE: "rgba(0, 255, 204, 1.0)",
  PINCH_INACTIVE: "rgba(255, 100, 100, 0.6)",
  BONE_WIDTH: 2.5,
  BONE_GLOW_WIDTH: 6,
  JOINT_RADIUS: 4,
  TIP_RADIUS: 6,
  GLOW_RADIUS: 24,
  GLOW_PULSE_SPEED: 5e-3
}, St = {
  ICE_BLUE: "#88ccff",
  WHITE: "#ffffff",
  PURPLE: "#aa88ff",
  HIGHLIGHT: "rgba(255, 255, 255, 0.85)",
  SHARD_BASE: "rgba(136, 204, 255, ",
  SHADOW: "rgba(170, 136, 255, ",
  BONE_WIDTH: 1.5,
  JOINT_DIAMOND_SIZE: 5,
  TIP_GLOW_RADIUS: 14,
  SHIMMER_SPEED: 3
}, bt = {
  YELLOW: "#ffcc00",
  ORANGE: "#ff6600",
  RED: "#ff0000",
  BONE_GLOW: "rgba(255, 80, 0, 0.5)",
  BONE_COLOR: "rgba(255, 120, 20, 0.7)",
  BONE_WIDTH: 2,
  BONE_GLOW_WIDTH: 5,
  MAX_PARTICLES: 200,
  SPAWN_RATE: 5,
  JOINT_COUNT: 21,
  PARTICLE_LIFETIME: 30
}, ct = {
  HUE_SPEED: 0.05,
  HUE_SHIFT_PER_FINGER: 60,
  SATURATION: 80,
  LIGHTNESS: 60,
  LAYER_COUNT: 3,
  LINE_WIDTH_BASE: 3,
  LINE_WIDTH_AMP: 2,
  LINE_WAVE_SPEED: 3e-3,
  TIP_GLOW_RADIUS: 16,
  COMPOSITE: "screen"
}, ht = {
  WHITE: "rgba(255, 255, 255, ",
  CYAN: "rgba(100, 220, 255, ",
  PARTICLES_PER_JOINT: 8,
  MAX_PARTICLES: 300,
  DRIFT_SPEED: 0.8,
  BASE_SIZE: 2,
  Z_SIZE_SCALE: 3,
  ALPHA_MIN: 0.2,
  ALPHA_MAX: 0.6,
  GLOW_BLUR: 8
}, br = class extends qt {
  name = "neon-skeleton";
  draw(t) {
    const { landmarks: e, isPinching: i, canvasWidth: s, canvasHeight: r, ctx: n, time: o } = t;
    this.drawBoneGlow(n, e, s, r), this.drawBones(n, e, s, r), this.drawJoints(n, e, s, r), this.drawFingerTips(n, e, s, r, i), this.drawIndexCursor(n, e, s, r, i, o), this.drawPinchArc(n, e, s, r, i);
  }
  drawBoneGlow(t, e, i, s) {
    t.save(), t.strokeStyle = et.ACCENT_DIM, t.lineWidth = et.BONE_GLOW_WIDTH, t.lineCap = "round", t.shadowColor = et.ACCENT_HEX, t.shadowBlur = 12;
    for (const [r, n] of Ut) {
      const o = e[r], a = e[n];
      !o || !a || (t.beginPath(), t.moveTo((1 - o.x) * i, o.y * s), t.lineTo((1 - a.x) * i, a.y * s), t.stroke());
    }
    t.restore();
  }
  drawBones(t, e, i, s) {
    t.strokeStyle = et.ACCENT + "0.6)", t.lineWidth = et.BONE_WIDTH, t.lineCap = "round";
    for (const [r, n] of Ut) {
      const o = e[r], a = e[n];
      !o || !a || (t.beginPath(), t.moveTo((1 - o.x) * i, o.y * s), t.lineTo((1 - a.x) * i, a.y * s), t.stroke());
    }
  }
  drawJoints(t, e, i, s) {
    for (let r = 0; r < e.length; r++) {
      const n = e[r], o = (1 - n.x) * i, a = n.y * s;
      Dt.includes(r) || (t.beginPath(), t.arc(o, a, et.JOINT_RADIUS, 0, Math.PI * 2), t.strokeStyle = et.ACCENT + "0.5)", t.lineWidth = 1.5, t.stroke(), t.beginPath(), t.arc(o, a, 1.5, 0, Math.PI * 2), t.fillStyle = et.ACCENT + "0.8)", t.fill());
    }
  }
  drawFingerTips(t, e, i, s, r) {
    for (const n of Dt) {
      const o = e[n];
      if (!o) continue;
      const a = (1 - o.x) * i, c = o.y * s, l = n === 8, h = l ? et.TIP_RADIUS : et.TIP_RADIUS * 0.7, d = l ? r ? 1 : 0.7 : 0.4;
      t.save(), t.shadowColor = et.ACCENT_HEX, t.shadowBlur = 8, t.beginPath(), t.arc(a, c, h, 0, Math.PI * 2), t.fillStyle = et.ACCENT + `${d * 0.3})`, t.fill(), t.restore(), t.beginPath(), t.arc(a, c, h, 0, Math.PI * 2), t.strokeStyle = et.ACCENT + `${d})`, t.lineWidth = 2, t.stroke(), t.beginPath(), t.arc(a, c, 2, 0, Math.PI * 2), t.fillStyle = et.ACCENT + `${d})`, t.fill();
    }
  }
  drawIndexCursor(t, e, i, s, r, n) {
    const o = e[8];
    if (!o) return;
    const a = (1 - o.x) * i, c = o.y * s, l = 1 + 0.25 * Math.sin(n * et.GLOW_PULSE_SPEED), h = et.GLOW_RADIUS * l, d = r ? et.PINCH_ACTIVE : et.PINCH_INACTIVE, u = t.createRadialGradient(a, c, h * 0.3, a, c, h);
    if (u.addColorStop(0, d), u.addColorStop(1, "rgba(0, 0, 0, 0)"), t.fillStyle = u, t.beginPath(), t.arc(a, c, h, 0, Math.PI * 2), t.fill(), r) {
      t.save(), t.strokeStyle = et.ACCENT + "0.3)", t.lineWidth = 1;
      const p = 15;
      t.beginPath(), t.moveTo(a - p, c), t.lineTo(a - 6, c), t.moveTo(a + 6, c), t.lineTo(a + p, c), t.moveTo(a, c - p), t.lineTo(a, c - 6), t.moveTo(a, c + 6), t.lineTo(a, c + p), t.stroke(), t.restore();
    }
  }
  drawPinchArc(t, e, i, s, r) {
    const n = e[4], o = e[8];
    if (!n || !o) return;
    const a = (1 - n.x) * i, c = n.y * s, l = (1 - o.x) * i, h = o.y * s, d = Math.sqrt((a - l) ** 2 + (c - h) ** 2);
    if (r)
      t.save(), t.shadowColor = et.ACCENT_HEX, t.shadowBlur = 10, t.strokeStyle = et.PINCH_ACTIVE, t.lineWidth = 2.5, t.beginPath(), t.moveTo(a, c), t.lineTo(l, h), t.stroke(), t.restore();
    else {
      t.save(), t.strokeStyle = et.PINCH_INACTIVE, t.lineWidth = 1, t.setLineDash([3, 5]);
      const u = (a + l) / 2, p = (c + h) / 2, f = -(h - c) * 0.3, m = (l - a) * 0.3;
      t.beginPath(), t.moveTo(a, c), t.quadraticCurveTo(u + f, p + m, l, h), t.stroke(), t.setLineDash([]), t.restore(), d > 30 && (t.save(), t.font = "10px monospace", t.fillStyle = "rgba(255, 255, 255, 0.3)", t.textAlign = "center", t.fillText(`${Math.round(d)}px`, (a + l) / 2, (c + h) / 2 - 8), t.restore());
    }
  }
}, kr = class extends qt {
  name = "crystal";
  draw(t) {
    const { landmarks: e, isPinching: i, canvasWidth: s, canvasHeight: r, ctx: n, time: o } = t;
    n.save(), this.drawCrystalBones(n, e, s, r, o), this.drawJointDiamonds(n, e, s, r, o), this.drawFingertipFlares(n, e, s, r, i, o), this.drawPinchBridge(n, e, s, r, i), n.restore();
  }
  drawCrystalBones(t, e, i, s, r) {
    for (let n = 0; n < Ut.length; n++) {
      const [o, a] = Ut[n], c = e[o], l = e[a];
      if (!c || !l) continue;
      const h = (1 - c.x) * i, d = c.y * s, u = (1 - l.x) * i, p = l.y * s, f = 0.35 + 0.15 * Math.sin(r * St.SHIMMER_SPEED + n * 0.7), m = t.createLinearGradient(h, d, u, p);
      m.addColorStop(0, St.SHARD_BASE + `${f})`), m.addColorStop(0.5, `rgba(255, 255, 255, ${f * 0.6})`), m.addColorStop(1, St.SHADOW + `${f})`), t.save(), t.strokeStyle = m, t.lineWidth = 5, t.lineCap = "round", t.shadowColor = St.ICE_BLUE, t.shadowBlur = 6, t.beginPath(), t.moveTo(h, d), t.lineTo(u, p), t.stroke(), t.restore(), t.save(), t.strokeStyle = `rgba(255, 255, 255, ${f * 0.5})`, t.lineWidth = St.BONE_WIDTH, t.lineCap = "round", t.beginPath(), t.moveTo(h, d), t.lineTo(u, p), t.stroke(), t.restore();
    }
  }
  drawJointDiamonds(t, e, i, s, r) {
    for (let n = 0; n < e.length; n++) {
      const o = e[n];
      if (Dt.includes(n)) continue;
      const a = (1 - o.x) * i, c = o.y * s, l = St.JOINT_DIAMOND_SIZE, h = 0.5 + 0.3 * Math.sin(r * St.SHIMMER_SPEED + n * 1.1);
      t.save(), t.translate(a, c), t.rotate(Math.PI / 4), t.fillStyle = `rgba(136, 204, 255, ${h * 0.4})`, t.shadowColor = St.ICE_BLUE, t.shadowBlur = 8, t.fillRect(-l / 2, -l / 2, l, l), t.strokeStyle = `rgba(255, 255, 255, ${h})`, t.lineWidth = 1, t.strokeRect(-l / 2, -l / 2, l, l), t.restore();
    }
  }
  drawFingertipFlares(t, e, i, s, r, n) {
    for (let o = 0; o < Dt.length; o++) {
      const a = Dt[o], c = e[a];
      if (!c) continue;
      const l = (1 - c.x) * i, h = c.y * s, d = a === 8, u = 1 + 0.2 * Math.sin(n * 4e-3 + o * 1.2), p = St.TIP_GLOW_RADIUS * u * (d ? 1.2 : 0.8), f = t.createRadialGradient(l, h, 0, l, h, p);
      f.addColorStop(0, d && r ? "rgba(255, 255, 255, 0.9)" : "rgba(200, 230, 255, 0.7)"), f.addColorStop(0.3, "rgba(136, 204, 255, 0.3)"), f.addColorStop(1, "rgba(170, 136, 255, 0)"), t.save(), t.shadowColor = St.ICE_BLUE, t.shadowBlur = 16, t.fillStyle = f, t.beginPath(), t.arc(l, h, p, 0, Math.PI * 2), t.fill(), t.restore();
      const m = 0.6 + 0.4 * Math.sin(n * 6e-3 + o * 0.9);
      t.beginPath(), t.arc(l, h, 2.5, 0, Math.PI * 2), t.fillStyle = `rgba(255, 255, 255, ${m})`, t.fill();
    }
  }
  drawPinchBridge(t, e, i, s, r) {
    const n = e[4], o = e[8];
    if (!n || !o) return;
    const a = (1 - n.x) * i, c = n.y * s, l = (1 - o.x) * i, h = o.y * s;
    if (r) {
      const d = t.createLinearGradient(a, c, l, h);
      d.addColorStop(0, "rgba(170, 136, 255, 0.9)"), d.addColorStop(0.5, "rgba(255, 255, 255, 0.95)"), d.addColorStop(1, "rgba(136, 204, 255, 0.9)"), t.save(), t.shadowColor = St.WHITE, t.shadowBlur = 14, t.strokeStyle = d, t.lineWidth = 3, t.lineCap = "round", t.beginPath(), t.moveTo(a, c), t.lineTo(l, h), t.stroke(), t.restore();
    } else
      t.save(), t.strokeStyle = "rgba(136, 204, 255, 0.25)", t.lineWidth = 1, t.setLineDash([4, 6]), t.lineCap = "round", t.beginPath(), t.moveTo(a, c), t.lineTo(l, h), t.stroke(), t.setLineDash([]), t.restore();
  }
}, Mr = class extends qt {
  name = "flame";
  particles = [];
  draw(t) {
    const { landmarks: e, canvasWidth: i, canvasHeight: s, ctx: r, isPinching: n } = t;
    this.spawnParticles(e, i, s), this.updateParticles(), r.save(), this.drawFlameBones(r, e, i, s), this.drawParticles(r), this.drawPinchFlare(r, e, i, s, n), r.restore();
  }
  destroy() {
    this.particles.length = 0;
  }
  spawnParticles(t, e, i) {
    if (this.particles.length >= bt.MAX_PARTICLES) return;
    const s = bt.MAX_PARTICLES - this.particles.length, r = Math.min(s, t.length * bt.SPAWN_RATE), n = Math.max(1, Math.floor(r / Math.max(t.length, 1)));
    for (let o = 0; o < t.length && this.particles.length < bt.MAX_PARTICLES; o++) {
      const a = t[o], c = (1 - a.x) * e, l = a.y * i;
      for (let h = 0; h < n; h++) this.particles.push({
        x: c + (Math.random() - 0.5) * 8,
        y: l + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(Math.random() * 2 + 0.5),
        life: 1
      });
    }
  }
  updateParticles() {
    const t = 1 / bt.PARTICLE_LIFETIME;
    for (let e = this.particles.length - 1; e >= 0; e--) {
      const i = this.particles[e];
      i.x += i.vx, i.y += i.vy, i.vx *= 0.96, i.life -= t, i.life <= 0 && (this.particles[e] = this.particles[this.particles.length - 1], this.particles.pop());
    }
  }
  drawParticles(t) {
    const e = t.globalCompositeOperation;
    t.globalCompositeOperation = "lighter";
    for (const i of this.particles) {
      const r = Math.round(i.life > 0.5 ? 204 * ((i.life - 0.5) * 2) + 102 * (1 - (i.life - 0.5) * 2) : 102 * (i.life * 2)), n = 0, o = i.life * 0.8, a = 2 + i.life * 3;
      t.beginPath(), t.arc(i.x, i.y, a, 0, Math.PI * 2), t.fillStyle = `rgba(255, ${r}, ${n}, ${o})`, t.fill();
    }
    t.globalCompositeOperation = e;
  }
  drawFlameBones(t, e, i, s) {
    t.save(), t.strokeStyle = bt.BONE_GLOW, t.lineWidth = bt.BONE_GLOW_WIDTH, t.lineCap = "round", t.shadowColor = bt.ORANGE, t.shadowBlur = 14;
    for (const [r, n] of Ut) {
      const o = e[r], a = e[n];
      !o || !a || (t.beginPath(), t.moveTo((1 - o.x) * i, o.y * s), t.lineTo((1 - a.x) * i, a.y * s), t.stroke());
    }
    t.restore(), t.strokeStyle = bt.BONE_COLOR, t.lineWidth = bt.BONE_WIDTH, t.lineCap = "round";
    for (const [r, n] of Ut) {
      const o = e[r], a = e[n];
      !o || !a || (t.beginPath(), t.moveTo((1 - o.x) * i, o.y * s), t.lineTo((1 - a.x) * i, a.y * s), t.stroke());
    }
  }
  drawPinchFlare(t, e, i, s, r) {
    if (!r) return;
    const n = e[4], o = e[8];
    if (!n || !o) return;
    const a = (1 - n.x) * i, c = n.y * s, l = (1 - o.x) * i, h = o.y * s, d = (a + l) / 2, u = (c + h) / 2, p = t.globalCompositeOperation;
    t.globalCompositeOperation = "lighter";
    const f = t.createRadialGradient(d, u, 0, d, u, 24);
    f.addColorStop(0, "rgba(255, 220, 0, 0.9)"), f.addColorStop(0.4, "rgba(255, 80, 0, 0.5)"), f.addColorStop(1, "rgba(255, 0, 0, 0)"), t.fillStyle = f, t.beginPath(), t.arc(d, u, 24, 0, Math.PI * 2), t.fill(), t.globalCompositeOperation = p;
  }
}, Cr = class extends qt {
  name = "aurora";
  draw(t) {
    const { landmarks: e, isPinching: i, canvasWidth: s, canvasHeight: r, ctx: n, time: o } = t;
    n.save();
    const a = n.globalCompositeOperation;
    n.globalCompositeOperation = ct.COMPOSITE, this.drawFingerRibbons(n, e, s, r, o), this.drawFingertipGlows(n, e, s, r, o), this.drawPalmWeb(n, e, s, r, o), n.globalCompositeOperation = a, this.drawPinchArc(n, e, s, r, i, o), n.restore();
  }
  drawFingerRibbons(t, e, i, s, r) {
    for (let n = 0; n < ze.length; n++) {
      const o = ze[n], a = (r * ct.HUE_SPEED + n * ct.HUE_SHIFT_PER_FINGER) % 360;
      for (let c = 0; c < ct.LAYER_COUNT; c++) {
        const l = (a + c * 20) % 360, h = 0.5 - c * 0.12, d = (ct.LINE_WIDTH_BASE + ct.LINE_WIDTH_AMP * Math.sin(r * ct.LINE_WAVE_SPEED + n + c)) * (1 - c * 0.2);
        t.strokeStyle = `hsla(${l}, ${ct.SATURATION}%, ${ct.LIGHTNESS}%, ${h})`, t.lineWidth = d, t.lineCap = "round", t.lineJoin = "round", t.shadowColor = `hsl(${l}, 100%, 70%)`, t.shadowBlur = 10 + c * 4, t.beginPath();
        const u = o[0];
        if (u === void 0) continue;
        const p = e[u];
        if (!p) continue;
        t.moveTo((1 - p.x) * i, p.y * s);
        for (let m = 0; m < o.length - 1; m++) {
          const y = o[m], S = o[m + 1], M = e[y], w = e[S];
          if (!M || !w) continue;
          const _ = (1 - M.x) * i, N = M.y * s, z = (1 - w.x) * i, C = w.y * s, I = (_ + z) / 2, H = (N + C) / 2;
          t.quadraticCurveTo(_, N, I, H);
        }
        const f = o[o.length - 1];
        if (f !== void 0) {
          const m = e[f];
          m && t.lineTo((1 - m.x) * i, m.y * s);
        }
        t.stroke();
      }
    }
  }
  drawFingertipGlows(t, e, i, s, r) {
    for (let n = 0; n < Dt.length; n++) {
      const o = e[Dt[n]];
      if (!o) continue;
      const a = (1 - o.x) * i, c = o.y * s, l = (r * ct.HUE_SPEED + n * ct.HUE_SHIFT_PER_FINGER) % 360, h = 1 + 0.25 * Math.sin(r * 4e-3 + n * 1.3), d = ct.TIP_GLOW_RADIUS * h, u = t.createRadialGradient(a, c, 0, a, c, d);
      u.addColorStop(0, `hsla(${l}, 100%, 80%, 0.7)`), u.addColorStop(0.5, `hsla(${l}, 90%, 60%, 0.3)`), u.addColorStop(1, `hsla(${l}, 80%, 50%, 0)`), t.fillStyle = u, t.beginPath(), t.arc(a, c, d, 0, Math.PI * 2), t.fill();
    }
  }
  drawPalmWeb(t, e, i, s, r) {
    const n = [
      5,
      9,
      13,
      17
    ], o = (r * ct.HUE_SPEED * 0.5 + 180) % 360;
    t.strokeStyle = `hsla(${o}, 70%, 65%, 0.25)`, t.lineWidth = 2, t.lineCap = "round", t.shadowBlur = 6, t.shadowColor = `hsl(${o}, 100%, 70%)`, t.beginPath();
    let a = !1;
    for (const c of n) {
      const l = e[c];
      if (!l) continue;
      const h = (1 - l.x) * i, d = l.y * s;
      a ? t.lineTo(h, d) : (t.moveTo(h, d), a = !0);
    }
    t.stroke();
  }
  drawPinchArc(t, e, i, s, r, n) {
    const o = e[4], a = e[8];
    if (!o || !a) return;
    const c = (1 - o.x) * i, l = o.y * s, h = (1 - a.x) * i, d = a.y * s, u = n * ct.HUE_SPEED % 360;
    if (r) {
      const p = t.createLinearGradient(c, l, h, d);
      p.addColorStop(0, `hsla(${u}, 100%, 70%, 0.9)`), p.addColorStop(1, `hsla(${(u + 60) % 360}, 100%, 70%, 0.9)`), t.save(), t.strokeStyle = p, t.lineWidth = 3, t.lineCap = "round", t.shadowColor = `hsl(${u}, 100%, 70%)`, t.shadowBlur = 12, t.beginPath(), t.moveTo(c, l), t.lineTo(h, d), t.stroke(), t.restore();
    } else {
      t.save(), t.strokeStyle = `hsla(${u}, 80%, 60%, 0.3)`, t.lineWidth = 1, t.setLineDash([4, 6]);
      const p = (c + h) / 2, f = (l + d) / 2, m = -(d - l) * 0.3, y = (h - c) * 0.3;
      t.beginPath(), t.moveTo(c, l), t.quadraticCurveTo(p + m, f + y, h, d), t.stroke(), t.setLineDash([]), t.restore();
    }
  }
}, Lr = class extends qt {
  name = "particle-cloud";
  particles = [];
  draw(t) {
    const { landmarks: e, canvasWidth: i, canvasHeight: s, ctx: r } = t;
    this.updateAndSpawn(e, i, s), this.renderParticles(r, e, i, s);
  }
  destroy() {
    this.particles.length = 0;
  }
  updateAndSpawn(t, e, i) {
    const s = 0.016666666666666666;
    for (let o = this.particles.length - 1; o >= 0; o--) {
      const a = this.particles[o];
      a.vx += (Math.random() - 0.5) * 0.4, a.vy += (Math.random() - 0.5) * 0.4;
      const c = t[a.landmarkIdx];
      if (c) {
        const l = (1 - c.x) * e, h = c.y * i;
        a.vx += (l - a.x) * 0.04, a.vy += (h - a.y) * 0.04;
      }
      a.vx *= 0.88, a.vy *= 0.88, a.x += a.vx, a.y += a.vy, a.life -= a.decay, a.life <= 0 && (this.particles[o] = this.particles[this.particles.length - 1], this.particles.pop());
    }
    if (this.particles.length >= ht.MAX_PARTICLES) return;
    const r = ht.MAX_PARTICLES - this.particles.length, n = Math.min(Math.floor(r / Math.max(t.length, 1)), ht.PARTICLES_PER_JOINT);
    for (let o = 0; o < t.length && this.particles.length < ht.MAX_PARTICLES; o++) {
      const a = t[o], c = (1 - a.x) * e, l = a.y * i;
      for (let h = 0; h < n; h++)
        this.particles.push({
          x: c + (Math.random() - 0.5) * 12,
          y: l + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * ht.DRIFT_SPEED,
          vy: (Math.random() - 0.5) * ht.DRIFT_SPEED,
          landmarkIdx: o,
          baseSize: ht.BASE_SIZE + Math.random() * 1.5,
          alpha: ht.ALPHA_MIN + Math.random() * (ht.ALPHA_MAX - ht.ALPHA_MIN),
          isCyan: Math.random() > 0.4,
          life: 1,
          decay: s * (0.8 + Math.random() * 0.4)
        });
    }
  }
  renderParticles(t, e, i, s) {
    t.save(), t.shadowBlur = ht.GLOW_BLUR;
    for (const r of this.particles) {
      const n = e[r.landmarkIdx], o = n ? Math.max(0, Math.min(1, 1 - n.z)) : 0.5, a = r.baseSize + o * ht.Z_SIZE_SCALE, c = r.alpha * r.life, l = r.isCyan ? ht.CYAN + `${c})` : ht.WHITE + `${c})`;
      t.shadowColor = r.isCyan ? "rgba(100, 220, 255, 0.4)" : "rgba(255, 255, 255, 0.3)", t.fillStyle = l, t.beginPath(), t.arc(r.x, r.y, a, 0, Math.PI * 2), t.fill();
    }
    t.restore();
  }
}, xr = {
  "neon-skeleton": () => new br(),
  crystal: () => new kr(),
  flame: () => new Mr(),
  aurora: () => new Cr(),
  "particle-cloud": () => new Lr()
};
function Ue(t) {
  const e = xr[t];
  return e();
}
var Wo = class {
  canvas;
  ctx;
  mode;
  style;
  styleName;
  constructor(t, e = "full", i = "neon-skeleton") {
    this.canvas = t, this.mode = e;
    const s = t.getContext("2d");
    if (!s) throw new Error("HandVisualizer: cannot get 2d context");
    this.ctx = s, this.styleName = i, this.style = Ue(i);
  }
  setStyle(t) {
    t !== this.styleName && (this.style.destroy(), this.styleName = t, this.style = Ue(t));
  }
  getStyle() {
    return this.styleName;
  }
  draw(t, e, i = !1) {
    const { ctx: s, canvas: r } = this, n = r.width, o = r.height;
    i || s.clearRect(0, 0, n, o), t.length !== 0 && (this.mode === "full" ? this.style.draw({
      landmarks: t,
      isPinching: e,
      canvasWidth: n,
      canvasHeight: o,
      ctx: s,
      time: performance.now(),
      dpr: window.devicePixelRatio ?? 1
    }) : this.drawMinimalCursor(t, n, o, e));
  }
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  destroy() {
    this.style.destroy();
  }
  drawMinimalCursor(t, e, i, s) {
    const r = t[8];
    if (!r) return;
    const { ctx: n } = this, o = (1 - r.x) * e, a = r.y * i, c = s ? "rgba(0, 255, 204, 1.0)" : "rgba(255, 100, 100, 0.6)";
    n.beginPath(), n.arc(o, a, 6, 0, Math.PI * 2), n.fillStyle = c, n.fill();
  }
};
function Er(t, e) {
  const i = t.x - e.x, s = t.y - e.y;
  return i * i + s * s;
}
function ne(t, e) {
  const i = t.x - e.x, s = t.y - e.y, r = t.z - e.z;
  return Math.sqrt(i * i + s * s + r * r);
}
function gi(t, e, i) {
  const s = t.x - e.x, r = t.y - e.y, n = t.z - e.z, o = i.x - e.x, a = i.y - e.y, c = i.z - e.z, l = s * o + r * a + n * c, h = Math.sqrt(s * s + r * r + n * n), d = Math.sqrt(o * o + a * a + c * c);
  if (h < 1e-4 || d < 1e-4) return 0;
  const u = Math.max(-1, Math.min(1, l / (h * d)));
  return Math.acos(u) * (180 / Math.PI);
}
function Vt(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
var Tr = 2 * Math.PI;
var Pr = 7e-3;
var Mt = class {
  xPrev = 0;
  dxPrev = 0;
  tPrev = 0;
  initialized = !1;
  minCutoff;
  beta;
  dCutoff;
  constructor(t = 1, e = Pr, i = 1) {
    this.minCutoff = t, this.beta = e, this.dCutoff = i;
  }
  filter(t, e) {
    if (!this.initialized) return this.initializeWith(t, e);
    const i = (e - this.tPrev) / 1e3;
    if (i <= 0) return this.xPrev;
    const s = this.computeSmoothedVelocity(t, i), r = He(i, this.minCutoff + this.beta * Math.abs(s)), n = r * t + (1 - r) * this.xPrev;
    return this.xPrev = n, this.dxPrev = s, this.tPrev = e, n;
  }
  reset() {
    this.initialized = !1;
  }
  initializeWith(t, e) {
    return this.xPrev = t, this.tPrev = e, this.initialized = !0, t;
  }
  computeSmoothedVelocity(t, e) {
    const i = (t - this.xPrev) / e, s = He(e, this.dCutoff);
    return s * i + (1 - s) * this.dxPrev;
  }
};
function He(t, e) {
  return 1 / (1 + 1 / (Tr * e) / t);
}
var Ir = class Tt {
  static ACTIVATE_THRESHOLD = 0.5;
  static DEACTIVATE_THRESHOLD = 0.15;
  static EMA_ALPHA = 0.4;
  static ACTIVATE_DEBOUNCE = 2;
  static DEACTIVATE_DEBOUNCE = 4;
  smoothedConfidence = 0;
  isPointing = !1;
  deactivateFrames = 0;
  activateFrames = 0;
  reset() {
    this.smoothedConfidence = 0, this.isPointing = !1, this.deactivateFrames = 0, this.activateFrames = 0;
  }
  update(e, i) {
    const s = i ?? e, r = this.computeConfidence(s);
    return this.smoothedConfidence = Tt.EMA_ALPHA * r + (1 - Tt.EMA_ALPHA) * this.smoothedConfidence, this.isPointing ? this.smoothedConfidence <= Tt.DEACTIVATE_THRESHOLD ? (this.deactivateFrames++, this.deactivateFrames >= Tt.DEACTIVATE_DEBOUNCE && (this.isPointing = !1, this.deactivateFrames = 0, this.activateFrames = 0)) : this.deactivateFrames = 0 : this.smoothedConfidence >= Tt.ACTIVATE_THRESHOLD ? (this.activateFrames++, this.activateFrames >= Tt.ACTIVATE_DEBOUNCE && (this.isPointing = !0, this.activateFrames = 0, this.deactivateFrames = 0)) : this.activateFrames = 0, this.isPointing;
  }
  getConfidence() {
    return this.smoothedConfidence;
  }
  computeConfidence(e) {
    const i = this.fingerExtensionScore(e, 8, 6, 7, 5), s = 1 - this.fingerExtensionScore(e, 12, 10, 11, 9) * 0.85, r = this.fingerExtensionScore(e, 16, 14, 15, 13), n = this.fingerExtensionScore(e, 20, 18, 19, 17), o = 0.6 + ((r < 0.4 ? 1 : 0) + (n < 0.4 ? 1 : 0)) * 0.2;
    return i * s * o;
  }
  fingerExtensionScore(e, i, s, r, n) {
    const o = e[0], a = e[i], c = e[n], l = e[s], h = e[r], d = ne(a, o), u = ne(c, o);
    return (Vt(((u > 1e-3 ? d / u : 0) - 1) / 0.5) + Vt((gi(l, h, a) - 80) / 80)) / 2;
  }
};
function Ge(t, e) {
  return Math.sqrt((t.x - e.x) ** 2 + (t.y - e.y) ** 2);
}
function zo(t, e, i) {
  const s = i - t.t;
  if (s <= 0) return 1 / 0;
  const r = e.x - t.x, n = e.y - t.y;
  return Math.sqrt(r * r + n * n) / s;
}
function je(t) {
  return 0.6 + Math.max(0, Math.min(1, -t / 0.15)) * 0.4;
}
var Xe = 3, Ve = 2, $e = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", qe = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm", _r = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
function Dr() {
  return `
let handLandmarker = null;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      importScripts(msg.bundleUrl);
      const vision = await self.FilesetResolver.forVisionTasks(msg.wasmUrl);
      handLandmarker = await self.HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: msg.modelUrl, delegate: 'GPU' },
        numHands: 2,
        runningMode: 'VIDEO',
        minHandDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
  }

  if (msg.type === 'detect') {
    if (!handLandmarker) {
      if (msg.frame && msg.frame.close) msg.frame.close();
      return;
    }
    try {
      const result = handLandmarker.detectForVideo(msg.frame, msg.timestamp);
      if (msg.frame && msg.frame.close) msg.frame.close();
      const landmarks = [];
      const worldLandmarks = [];
      for (const hand of (result.landmarks || [])) {
        landmarks.push(hand.map(function(lm) { return { x: lm.x, y: lm.y, z: lm.z }; }));
      }
      for (const hand of (result.worldLandmarks || [])) {
        worldLandmarks.push(hand.map(function(lm) { return { x: lm.x, y: lm.y, z: lm.z }; }));
      }
      self.postMessage({ type: 'result', landmarks: landmarks, worldLandmarks: worldLandmarks });
    } catch (err) {
      if (msg.frame && msg.frame.close) msg.frame.close();
      self.postMessage({ type: 'error', error: String(err) });
    }
  }

  if (msg.type === 'destroy') {
    if (handLandmarker) { handLandmarker.close(); handLandmarker = null; }
    self.close();
  }
};
`;
}
var Nr = class jt {
  canvas = null;
  video = null;
  stream = null;
  handLandmarker = null;
  animFrameId = null;
  active = !1;
  worker = null;
  workerBusy = !1;
  workerReady = !1;
  workerInitTimeout = null;
  externalWorkerUrl = null;
  penDown = !1;
  alwaysDrawMode = !1;
  drawingPaused = !1;
  onTransitMove = null;
  gestureDetector = new Ir();
  noHandFrames = 0;
  NO_HAND_DEBOUNCE = 5;
  pendingStateFrames = 0;
  pendingState = !1;
  lastDrawPos = null;
  pauseFrames = 0;
  pausedAt = null;
  xFilter = new Mt(1, 0.5, 1);
  yFilter = new Mt(1, 0.5, 1);
  penDown2 = !1;
  pendingStateFrames2 = 0;
  pendingState2 = !1;
  lastDrawPos2 = null;
  xFilter2 = new Mt(1, 0.5, 1);
  yFilter2 = new Mt(1, 0.5, 1);
  onPoint2 = null;
  onPenState2 = null;
  onPoint;
  onPenState;
  onError;
  onSuccess;
  onLandmarks = null;
  onGestureLandmarks = null;
  onHandVisibility = null;
  handWasVisible = !1;
  constructor(e, i, s = () => {
  }, r = () => {
  }) {
    this.onPoint = e, this.onPenState = i, this.onError = s, this.onSuccess = r;
  }
  setWorkerUrl(e) {
    this.externalWorkerUrl = e;
  }
  setAlwaysDrawMode(e) {
    this.alwaysDrawMode = e;
  }
  setTransitMoveCallback(e) {
    this.onTransitMove = e;
  }
  setDrawingPaused(e) {
    this.drawingPaused = e, e && this.penDown && (this.penDown = !1, this.lastDrawPos = null, this.pauseFrames = 0, this.pausedAt = null, this.xFilter.reset(), this.yFilter.reset(), this.onPenState(!1));
  }
  setHandVisibilityCallback(e) {
    this.onHandVisibility = e;
  }
  setLandmarkCallback(e) {
    this.onLandmarks = e;
  }
  setGestureCallback(e) {
    this.onGestureLandmarks = e;
  }
  setSecondHandCallbacks(e, i) {
    this.onPoint2 = e, this.onPenState2 = i, (!e || !i) && (this.penDown2 && this.onPenState2?.(!1), this.penDown2 = !1, this.pendingStateFrames2 = 0, this.pendingState2 = !1, this.lastDrawPos2 = null, this.xFilter2.reset(), this.yFilter2.reset());
  }
  getVideoElement() {
    return this.video;
  }
  start(e) {
    if (!this.active) {
      if (!Fr()) {
        this.onError(/* @__PURE__ */ new Error("CameraCapture requires a browser environment"));
        return;
      }
      this.canvas = e, this.active = !0, this.initAsync().catch((i) => {
        this.handleInitError(i);
      });
    }
  }
  stop() {
    this.active && (this.active = !1, this.cancelAnimationFrame(), this.terminateWorker(), this.releaseCamera(), this.releaseHandLandmarker(), this.canvas = null, this.penDown = !1, this.pendingStateFrames = 0, this.pendingState = !1, this.gestureDetector.reset(), this.lastDrawPos = null, this.pauseFrames = 0, this.pausedAt = null, this.xFilter.reset(), this.yFilter.reset(), this.penDown2 = !1, this.pendingStateFrames2 = 0, this.pendingState2 = !1, this.lastDrawPos2 = null, this.xFilter2.reset(), this.yFilter2.reset(), this.onLandmarks = null);
  }
  isActive() {
    return this.active;
  }
  async initAsync() {
    if (await this.startCamera(), !this.active) return;
    const e = await jt.shouldPreferSync();
    if (this.active) {
      if (e) {
        await this.initMediaPipeSync();
        return;
      }
      if (this.tryCreateWorker()) {
        this.workerInitTimeout = setTimeout(() => {
          this.active && (this.workerReady || (console.warn("[CameraCapture] Worker init timed out after 10s, falling back to sync"), this.terminateWorker(), this.initMediaPipeSync().catch((i) => this.handleInitError(i))));
        }, 1e4);
        return;
      }
      await this.initMediaPipeSync();
    }
  }
  static async shouldPreferSync() {
    const e = typeof localStorage < "u" ? localStorage.getItem("glymo-mp-mode") : null;
    if (e === "sync") return !0;
    if (e === "worker") return !1;
    if (typeof navigator < "u" && "gpu" in navigator) try {
      const i = await navigator.gpu.requestAdapter();
      if (i) {
        const s = await i.requestAdapterInfo?.() ?? i.info, r = (s?.description ?? s?.device ?? "").toLowerCase(), n = (s?.architecture ?? "").toLowerCase(), o = r.includes("apple") || n.includes("apple"), a = /m[123]\b/.test(r) || /m[123]\b/.test(n) || r.includes("m1 pro") || r.includes("m2 pro"), c = r.includes("m4") || r.includes("m3 max") || r.includes("m3 ultra");
        if (o && a && !c)
          return localStorage?.setItem("glymo-mp-mode", "sync"), !0;
        if (o && c)
          return localStorage?.setItem("glymo-mp-mode", "worker"), !1;
      }
    } catch {
    }
    return !1;
  }
  async initMediaPipeSync() {
    const e = await Br();
    if (!this.active) return;
    const i = await e.FilesetResolver.forVisionTasks(qe);
    this.active && (this.handLandmarker = await e.HandLandmarker.createFromOptions(i, {
      baseOptions: {
        modelAssetPath: $e,
        delegate: "GPU"
      },
      numHands: 2,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    }), this.active && (this.startDetectionLoop(), this.onSuccess()));
  }
  async startCamera() {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    } }), this.video = document.createElement("video"), this.video.srcObject = this.stream, this.video.setAttribute("playsinline", ""), await this.video.play();
  }
  handleInitError(e) {
    const i = e instanceof Error ? e : new Error(String(e));
    this.active = !1, this.releaseCamera(), this.onError(i);
  }
  tryCreateWorker() {
    if (typeof Worker > "u" || typeof createImageBitmap > "u") return !1;
    try {
      if (this.externalWorkerUrl) {
        const e = this.externalWorkerUrl + "?v=" + Date.now();
        this.worker = new Worker(e);
      } else {
        const e = new Blob([Dr()], { type: "text/javascript" }), i = URL.createObjectURL(e);
        this.worker = new Worker(i), URL.revokeObjectURL(i);
      }
      return this.worker.onmessage = this.handleWorkerMessage, this.worker.onerror = () => {
        this.active && (this.terminateWorker(), this.initMediaPipeSync().catch((e) => this.handleInitError(e)));
      }, this.worker.postMessage({
        type: "init",
        bundleUrl: _r,
        wasmUrl: qe,
        modelUrl: $e,
        delegate: "GPU"
      }), !0;
    } catch {
      return this.terminateWorker(), !1;
    }
  }
  workerDetectErrors = 0;
  static MAX_WORKER_ERRORS = 3;
  static CALIBRATION_FRAMES = 10;
  static ROUNDTRIP_THRESHOLD_MS = 60;
  calibrationRoundtrips = [];
  workerSendTime = 0;
  calibrationDone = !1;
  handleWorkerMessage = (e) => {
    if (!this.active) return;
    const i = e.data;
    if (i.type === "ready")
      this.workerReady = !0, this.workerInitTimeout && (clearTimeout(this.workerInitTimeout), this.workerInitTimeout = null), this.startWorkerDetectionLoop(), this.onSuccess();
    else if (i.type === "result") {
      if (this.workerBusy = !1, this.workerDetectErrors = 0, !this.calibrationDone && this.workerSendTime > 0) {
        const s = performance.now() - this.workerSendTime;
        if (this.calibrationRoundtrips.push(s), this.calibrationRoundtrips.length >= jt.CALIBRATION_FRAMES && (this.calibrationDone = !0, this.calibrationRoundtrips.reduce((r, n) => r + n, 0) / this.calibrationRoundtrips.length > jt.ROUNDTRIP_THRESHOLD_MS)) {
          this.processDetectionResult({
            landmarks: i.landmarks ?? [],
            worldLandmarks: i.worldLandmarks ?? []
          }), this.cancelAnimationFrame(), this.terminateWorker(), this.initMediaPipeSync().catch((r) => this.handleInitError(r));
          return;
        }
      }
      this.processDetectionResult({
        landmarks: i.landmarks ?? [],
        worldLandmarks: i.worldLandmarks ?? []
      });
    } else if (i.type === "error") {
      if (this.workerBusy = !1, !this.workerReady) {
        console.warn("[CameraCapture] Worker init failed:", i.error, "→ falling back to sync"), this.workerInitTimeout && (clearTimeout(this.workerInitTimeout), this.workerInitTimeout = null), this.terminateWorker(), this.initMediaPipeSync().catch((s) => this.handleInitError(s));
        return;
      }
      this.workerDetectErrors++, this.workerDetectErrors >= jt.MAX_WORKER_ERRORS && (this.terminateWorker(), this.initMediaPipeSync().catch((s) => this.handleInitError(s)));
    }
  };
  sendFrameToWorker() {
    this.workerBusy || !this.video || !this.worker || this.video.readyState < 2 || (this.workerBusy = !0, createImageBitmap(this.video).then((e) => {
      if (!this.active || !this.worker) {
        e.close(), this.workerBusy = !1;
        return;
      }
      const i = performance.now();
      this.workerSendTime = i, this.worker.postMessage({
        type: "detect",
        frame: e,
        timestamp: i
      }, [e]);
    }).catch(() => {
      this.workerBusy = !1;
    }));
  }
  startWorkerDetectionLoop() {
    const e = () => {
      this.active && (this.sendFrameToWorker(), this.animFrameId = requestAnimationFrame(e));
    };
    this.animFrameId = requestAnimationFrame(e);
  }
  terminateWorker() {
    if (this.worker) {
      this.worker.onmessage = null, this.worker.onerror = null;
      try {
        this.worker.postMessage({ type: "destroy" });
      } catch {
      }
      this.worker.terminate(), this.worker = null;
    }
    this.workerBusy = !1, this.workerDetectErrors = 0, this.calibrationRoundtrips = [], this.workerSendTime = 0, this.calibrationDone = !1;
  }
  startDetectionLoop() {
    const e = () => {
      this.active && (this.processFrameSync(), this.animFrameId = requestAnimationFrame(e));
    };
    this.animFrameId = requestAnimationFrame(e);
  }
  processFrameSync() {
    if (!this.video || !this.handLandmarker || !this.canvas || this.video.readyState < 2) return;
    const e = this.handLandmarker.detectForVideo(this.video, performance.now());
    this.processDetectionResult(e);
  }
  processDetectionResult(e) {
    if (!this.canvas || !this.video) return;
    if (!((e.landmarks?.length ?? 0) > 0)) {
      this.noHandFrames++, this.penDown && this.noHandFrames >= this.NO_HAND_DEBOUNCE && (this.penDown = !1, this.lastDrawPos = null, this.pauseFrames = 0, this.pausedAt = null, this.xFilter.reset(), this.yFilter.reset(), this.onPenState(!1)), this.handWasVisible && this.noHandFrames >= this.NO_HAND_DEBOUNCE && (this.handWasVisible = !1, this.onHandVisibility?.(!1)), this.onLandmarks && this.noHandFrames >= this.NO_HAND_DEBOUNCE && this.onLandmarks([], !1);
      return;
    }
    this.handWasVisible || (this.handWasVisible = !0, this.onHandVisibility?.(!0)), this.noHandFrames = 0;
    const i = e.landmarks[0], s = e.worldLandmarks[0], r = this.canvas.width, n = this.canvas.height, o = performance.now(), a = this.video.videoWidth || 640, c = this.video.videoHeight || 480, l = Math.max(r / a, n / c), h = a * l, d = c * l, u = (h - r) / 2, p = (d - n) / 2, f = (H) => ({
      x: (H.x * h - u) / r,
      y: (H.y * d - p) / n,
      z: H.z
    }), m = i.map(f), y = (e.landmarks?.length ?? 0) > 1 ? e.landmarks[1].map(f) : void 0;
    let S;
    if (this.drawingPaused) {
      S = !1, this.onLandmarks && this.onLandmarks(m, !1, y);
      return;
    }
    if (this.alwaysDrawMode ? S = this.detectPenState(i, s) : S = this.detectPenState(i, s), this.onLandmarks && this.onLandmarks(m, S, y), this.onGestureLandmarks) {
      const H = (e.landmarks?.length ?? 0) > 1 ? e.landmarks[1] : void 0;
      this.onGestureLandmarks(i, H);
    }
    const M = m[8], w = m[7], _ = s[8].z, N = Vt((s[5].z - _ - 0.01) / 0.04) * 0.3, z = (1 - (M.x * (1 - N) + w.x * N)) * r, C = (M.y * (1 - N) + w.y * N) * n, I = {
      x: S ? this.xFilter.filter(z, o) : z,
      y: S ? this.yFilter.filter(C, o) : C,
      z: s[8].z
    };
    this.emitPoint(I, o), this.onPoint2 && this.onPenState2 && !this.drawingPaused && y ? this.processSecondHand(y, o, r, n) : this.penDown2 && this.onPenState2 && !y && (this.penDown2 = !1, this.pendingStateFrames2 = 0, this.lastDrawPos2 = null, this.xFilter2.reset(), this.yFilter2.reset(), this.onPenState2(!1));
  }
  processSecondHand(e, i, s, r) {
    if (e.length < 21) return;
    const n = Ge(e[4], e[8]) < Le;
    if (n !== this.penDown2 ? (n === this.pendingState2 ? this.pendingStateFrames2++ : (this.pendingState2 = n, this.pendingStateFrames2 = 1), this.pendingStateFrames2 >= Xe && (this.penDown2 = n, this.pendingStateFrames2 = 0, this.lastDrawPos2 = null, n ? (this.xFilter2.reset(), this.yFilter2.reset(), this.onPenState2(!0)) : (this.xFilter2.reset(), this.yFilter2.reset(), this.onPenState2(!1)))) : this.pendingStateFrames2 = 0, !this.penDown2) return;
    const o = e[8], a = (1 - o.x) * s, c = o.y * r, l = this.xFilter2.filter(a, i), h = this.yFilter2.filter(c, i);
    if (this.lastDrawPos2) {
      const u = l - this.lastDrawPos2.x, p = h - this.lastDrawPos2.y;
      if (Math.sqrt(u * u + p * p) < Ve) return;
    }
    this.lastDrawPos2 = {
      x: l,
      y: h
    };
    const d = {
      x: l,
      y: h,
      t: i,
      source: "camera",
      pressure: je(o.z)
    };
    this.onPoint2(d);
  }
  detectPenState(e, i) {
    const s = Ge(e[4], e[8]) < Le;
    return s !== this.penDown ? (s === this.pendingState ? this.pendingStateFrames++ : (this.pendingState = s, this.pendingStateFrames = 1), this.pendingStateFrames >= Xe && (this.penDown = s, this.pendingStateFrames = 0, s ? (this.lastDrawPos = null, this.pauseFrames = 0, this.pausedAt = null, this.onPenState(!0)) : (this.lastDrawPos = null, this.pauseFrames = 0, this.pausedAt = null, this.onPenState(!1)))) : this.pendingStateFrames = 0, s;
  }
  emitPoint(e, i) {
    const { x: s, y: r } = e;
    if (!this.penDown) return;
    if (this.lastDrawPos) {
      const l = s - this.lastDrawPos.x, h = r - this.lastDrawPos.y;
      if (Math.sqrt(l * l + h * h) < Ve) return;
    }
    const n = 3, o = 5, a = 40;
    if (this.lastDrawPos) {
      const l = s - this.lastDrawPos.x, h = r - this.lastDrawPos.y;
      if (Math.sqrt(l * l + h * h) < n)
        this.pauseFrames++, this.pauseFrames >= o && !this.pausedAt && (this.pausedAt = {
          x: s,
          y: r
        });
      else {
        if (this.pausedAt) {
          const d = s - this.pausedAt.x, u = r - this.pausedAt.y;
          Math.sqrt(d * d + u * u) > a && (this.onTransitMove && this.onTransitMove(s, r), this.onPenState(!1), this.onPenState(!0), this.lastDrawPos = null), this.pausedAt = null;
        }
        this.pauseFrames = 0;
      }
    }
    this.lastDrawPos = {
      x: s,
      y: r
    };
    const c = {
      x: s,
      y: r,
      t: i,
      source: "camera",
      pressure: je(e.z)
    };
    this.onPoint(c);
  }
  cancelAnimationFrame() {
    this.animFrameId !== null && (cancelAnimationFrame(this.animFrameId), this.animFrameId = null);
  }
  releaseCamera() {
    if (this.stream) {
      for (const e of this.stream.getTracks()) e.stop();
      this.stream = null;
    }
    this.video && (this.video.srcObject = null, this.video = null);
  }
  releaseHandLandmarker() {
    this.handLandmarker && (this.handLandmarker.close(), this.handLandmarker = null);
  }
};
function Fr() {
  return typeof window < "u" && typeof navigator < "u" && typeof document < "u";
}
async function Br() {
  try {
    return await import("@mediapipe/tasks-vision");
  } catch {
    throw new Error("@mediapipe/tasks-vision is not installed. Install it as a peer dependency: npm install @mediapipe/tasks-vision");
  }
}
var Or = {
  index: {
    tip: 8,
    pip: 6,
    mcp: 5
  },
  middle: {
    tip: 12,
    pip: 10,
    mcp: 9
  },
  ring: {
    tip: 16,
    pip: 14,
    mcp: 13
  },
  pinky: {
    tip: 20,
    pip: 18,
    mcp: 17
  }
}, oe = class {
  landmarks;
  _scoreCache = /* @__PURE__ */ new Map();
  constructor(t) {
    this.landmarks = Object.freeze([...t]);
  }
  extended(...t) {
    return t.every((e) => this.fingerScore(e) > wr);
  }
  folded(...t) {
    return t.every((e) => this.fingerScore(e) < vr);
  }
  pinchDistance() {
    const t = this._lm(4), e = this._lm(8);
    return Math.sqrt(Er(t, e));
  }
  fingerScore(t) {
    const e = this._scoreCache.get(t);
    if (e !== void 0) return e;
    const i = t === "thumb" ? this._thumbScore() : this._fingerAngleScore(Or[t]);
    return this._scoreCache.set(t, i), i;
  }
  _lm(t) {
    return this.landmarks[t] ?? {
      x: 0,
      y: 0,
      z: 0
    };
  }
  _thumbScore() {
    const t = this._lm(0), e = this._lm(4), i = this._lm(2), s = ne(e, t), r = ne(i, t);
    return r < 1e-3 ? 0 : Vt((s / r - 1) / (Ar - 1));
  }
  _fingerAngleScore(t) {
    return Vt((gi(this._lm(t.mcp), this._lm(t.pip), this._lm(t.tip)) - 90) / 70);
  }
}, Ye = {
  pinch: (t) => t.pinchDistance() < Le,
  fist: (t) => t.folded("index", "middle", "ring", "pinky"),
  point: (t) => t.extended("index") && t.folded("middle", "ring", "pinky"),
  "open-palm": (t) => t.extended("thumb", "index", "middle", "ring", "pinky"),
  "peace-sign": (t) => t.extended("index", "middle") && t.folded("ring", "pinky"),
  "thumbs-up": (t) => t.extended("thumb") && t.folded("index", "middle", "ring", "pinky")
}, Rr = class {
  _emit;
  _gestures = /* @__PURE__ */ new Map();
  constructor(t) {
    this._emit = t, this._registerBuiltins();
  }
  define(t, e) {
    this._gestures.set(t, {
      detector: e,
      isActive: !1,
      activateFrames: 0,
      deactivateFrames: 0
    });
  }
  update(t, e) {
    const i = new oe(t ?? []), s = e !== void 0 ? new oe(e) : void 0;
    for (const [r, n] of this._gestures) {
      const o = this._safeDetect(n.detector, i, s);
      this._updateRecord(r, n, o, i, s);
    }
  }
  getState(t) {
    return this._gestures.get(t)?.isActive ? "active" : "inactive";
  }
  _registerBuiltins() {
    const t = Object.keys(Ye);
    for (const e of t) this.define(e, Ye[e]);
  }
  _safeDetect(t, e, i) {
    try {
      return t(e, i);
    } catch {
      return !1;
    }
  }
  _updateRecord(t, e, i, s, r) {
    e.isActive ? i ? e.deactivateFrames = 0 : (e.deactivateFrames++, e.activateFrames = 0, e.deactivateFrames >= 2 && (e.isActive = !1, e.deactivateFrames = 0, this._emitEvent(`gesture:${t}:end`, t, s, r))) : i ? (e.activateFrames++, e.deactivateFrames = 0, e.activateFrames >= 2 && (e.isActive = !0, e.activateFrames = 0, this._emitEvent(`gesture:${t}`, t, s, r))) : e.activateFrames = 0;
  }
  _emitEvent(t, e, i, s) {
    const r = {
      gesture: e,
      hand: i,
      secondHand: s,
      timestamp: performance.now()
    };
    this._emit(t, r);
  }
}, Wr = {
  pulse: 0.15,
  sparkle: 0.1,
  float: 20,
  bounce: 30,
  fly: 200,
  shake: 10,
  fadeOut: 0,
  rotate: 0
}, zr = 90, Zt = Math.PI * 2, Ur = Math.PI / 180;
function Ot(t, e, i) {
  return t + (e - t) * i;
}
var Hr = class {
  animations = /* @__PURE__ */ new Map();
  nextId = 0;
  addAnimation(t, e) {
    const i = `anim_${this.nextId++}`, s = {
      strokeIds: t,
      params: e,
      startTime: performance.now(),
      active: !0
    };
    return this.animations.set(i, s), i;
  }
  removeAnimation(t) {
    this.animations.delete(t);
  }
  removeByStrokeId(t) {
    for (const [e, i] of this.animations) {
      const s = i.strokeIds.indexOf(t);
      s !== -1 && (i.strokeIds.splice(s, 1), i.strokeIds.length === 0 && this.animations.delete(e));
    }
  }
  getTransform(t, e) {
    let i = !1, s = 0, r = 0, n = 1, o = 0, a = 1, c = 1;
    const l = [];
    for (const [h, d] of this.animations) {
      if (!d.active || !d.strokeIds.includes(t)) continue;
      const u = d.params.delay ?? 0, p = e - d.startTime - u;
      if (p < 0) continue;
      i = !0;
      const f = d.params.duration;
      let m;
      d.params.repeat ? m = p % f / f : (m = Math.min(p / f, 1), m >= 1 && (d.active = !1, l.push(h)));
      const y = this.computeAnimationTransform(d.params, m, p);
      s += y.translateX, r += y.translateY, n *= y.scale, o += y.rotation, a *= y.opacity, c *= y.glowIntensity;
    }
    for (const h of l) this.animations.delete(h);
    return i ? {
      translateX: s,
      translateY: r,
      scale: n,
      rotation: o,
      opacity: a,
      glowIntensity: c
    } : null;
  }
  hasAnimations() {
    for (const t of this.animations.values()) if (t.active) return !0;
    return !1;
  }
  getSparkleStrokeIds(t) {
    const e = [];
    for (const i of this.animations.values()) {
      if (!i.active || i.params.type !== "sparkle") continue;
      const s = i.params.delay ?? 0;
      if (!(t - i.startTime - s < 0))
        for (const r of i.strokeIds) e.includes(r) || e.push(r);
    }
    return e;
  }
  getAnimationParams(t) {
    for (const [, e] of this.animations)
      if (e.active && e.strokeIds.includes(t))
        return e.params;
    return null;
  }
  clear() {
    this.animations.clear();
  }
  computeAnimationTransform(t, e, i) {
    const s = {
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      glowIntensity: 1
    }, r = t.amplitude ?? Wr[t.type] ?? 0;
    switch (t.type) {
      case "pulse":
        s.scale = 1 + r * Math.sin(e * Zt), s.opacity = 0.8 + 0.2 * Math.sin(e * Zt);
        break;
      case "sparkle":
        s.glowIntensity = 1 + 0.4 * Math.sin(e * Zt);
        break;
      case "float":
        s.translateY = -r * Math.sin(e * Zt);
        break;
      case "bounce":
        s.translateY = -r * Math.abs(Math.sin(e * Math.PI));
        break;
      case "rotate":
        s.rotation = (t.speed ?? zr) * Ur * i / 1e3;
        break;
      case "fly": {
        const n = t.direction ?? "up", o = e;
        switch (n) {
          case "up":
            s.translateY = -r * o;
            break;
          case "down":
            s.translateY = r * o;
            break;
          case "left":
            s.translateX = -r * o;
            break;
          case "right":
            s.translateX = r * o;
            break;
        }
        e > 0.7 && (s.opacity = 1 - (e - 0.7) / 0.3);
        break;
      }
      case "shake":
        s.translateX = r * Math.sin(e * 20 * Math.PI) * (1 - e);
        break;
      case "fadeOut":
        s.opacity = 1 - e;
        break;
      case "keyframe": {
        if (!t.keyframes || t.keyframes.length === 0) break;
        const n = this.interpolateKeyframes(t.keyframes, e);
        s.translateX = n.x ?? 0, s.translateY = n.y ?? 0, s.scale = n.scale ?? 1, s.rotation = n.rotation ?? 0, s.opacity = n.opacity ?? 1, s.glowIntensity = n.glow ?? 1;
        break;
      }
    }
    return s;
  }
  interpolateKeyframes(t, e) {
    if (t.length === 1) return t[0];
    let i = t[0], s = t[t.length - 1];
    for (let o = 0; o < t.length - 1; o++) if (e >= t[o].t && e <= t[o + 1].t) {
      i = t[o], s = t[o + 1];
      break;
    }
    const r = s.t - i.t, n = r > 0 ? (e - i.t) / r : 0;
    return {
      t: e,
      x: Ot(i.x ?? 0, s.x ?? 0, n),
      y: Ot(i.y ?? 0, s.y ?? 0, n),
      scale: Ot(i.scale ?? 1, s.scale ?? 1, n),
      rotation: Ot(i.rotation ?? 0, s.rotation ?? 0, n),
      opacity: Ot(i.opacity ?? 1, s.opacity ?? 1, n),
      glow: Ot(i.glow ?? 1, s.glow ?? 1, n)
    };
  }
}, Gr = class {
  objects = /* @__PURE__ */ new Map();
  strokeToObject = /* @__PURE__ */ new Map();
  fillToObject = /* @__PURE__ */ new Map();
  creationOrder = [];
  createObject(t, e) {
    const i = crypto.randomUUID(), s = {
      id: i,
      strokeIds: [...t],
      fillIds: [],
      bbox: { ...e },
      createdAt: Date.now()
    };
    this.objects.set(i, s), this.creationOrder.push(i);
    for (const r of t) {
      const n = this.strokeToObject.get(r);
      if (n && n !== i) {
        const o = this.objects.get(n);
        o && (o.strokeIds = o.strokeIds.filter((a) => a !== r));
      }
      this.strokeToObject.set(r, i);
    }
    return s;
  }
  addFillToObject(t, e) {
    const i = this.objects.get(t);
    return i ? (i.fillIds.push(e), this.fillToObject.set(e, t), !0) : !1;
  }
  getObject(t) {
    return this.objects.get(t);
  }
  getObjectByStrokeId(t) {
    const e = this.strokeToObject.get(t);
    return e ? this.objects.get(e) : void 0;
  }
  getObjectByFillId(t) {
    const e = this.fillToObject.get(t);
    return e ? this.objects.get(e) : void 0;
  }
  getLastObject() {
    const t = this.creationOrder[this.creationOrder.length - 1];
    return t ? this.objects.get(t) : void 0;
  }
  getAllObjects() {
    return this.creationOrder.map((t) => this.objects.get(t)).filter((t) => t != null);
  }
  removeObject(t) {
    const e = this.objects.get(t);
    if (e) {
      for (const i of e.strokeIds) this.strokeToObject.delete(i);
      for (const i of e.fillIds) this.fillToObject.delete(i);
      return this.objects.delete(t), this.creationOrder = this.creationOrder.filter((i) => i !== t), e;
    }
  }
  removeLastObject() {
    const t = this.creationOrder[this.creationOrder.length - 1];
    if (t)
      return this.removeObject(t);
  }
  addStrokeToObject(t, e) {
    const i = this.objects.get(t);
    if (!i) return !1;
    const s = this.strokeToObject.get(e);
    if (s && s !== t) {
      const r = this.objects.get(s);
      r && (r.strokeIds = r.strokeIds.filter((n) => n !== e));
    }
    return i.strokeIds.includes(e) || i.strokeIds.push(e), this.strokeToObject.set(e, t), !0;
  }
  removeStrokeFromObject(t) {
    const e = this.strokeToObject.get(t);
    if (!e) return;
    const i = this.objects.get(e);
    i && (i.strokeIds = i.strokeIds.filter((s) => s !== t)), this.strokeToObject.delete(t);
  }
  setAnimationId(t, e) {
    const i = this.objects.get(t);
    i && (i.animationId = e);
  }
  get size() {
    return this.objects.size;
  }
  updateMetadata(t, e, i) {
    const s = this.objects.get(t);
    return s ? (s.metadata || (s.metadata = {}), s.metadata[e] = i, !0) : !1;
  }
  clear() {
    this.objects.clear(), this.strokeToObject.clear(), this.fillToObject.clear(), this.creationOrder = [];
  }
}, jr = class {
  selected = /* @__PURE__ */ new Set();
  constructor(t) {
    this.eventBus = t;
  }
  select(t) {
    this.selected.has(t) || (this.selected.add(t), this.eventBus.emit("object:selected", { objectId: t }), this.emitChanged());
  }
  deselect(t) {
    this.selected.delete(t) && (this.eventBus.emit("object:deselected", { objectId: t }), this.emitChanged());
  }
  toggle(t) {
    this.selected.has(t) ? this.deselect(t) : this.select(t);
  }
  clearSelection() {
    if (this.selected.size !== 0) {
      for (const t of this.selected) this.eventBus.emit("object:deselected", { objectId: t });
      this.selected.clear(), this.emitChanged();
    }
  }
  isSelected(t) {
    return this.selected.has(t);
  }
  getSelectedIds() {
    return this.selected;
  }
  get count() {
    return this.selected.size;
  }
  removeIfSelected(t) {
    this.selected.delete(t) && (this.eventBus.emit("object:deselected", { objectId: t }), this.emitChanged());
  }
  emitChanged() {
    this.eventBus.emit("selection:changed", { selectedIds: [...this.selected] });
  }
}, Xr = 15;
function Vr(t, e, i = Xr) {
  if (t.length < 4) return {
    snapped: !1,
    end: "none",
    targetStrokeIds: [],
    correctedRaw: [...t]
  };
  const s = i * i;
  let r = t.map((f) => ({ ...f }));
  const n = [];
  let o = !1, a = !1;
  const c = r[r.length - 1], l = r[0], h = $r(c, l), d = Si(c, e, s), u = d?.dist ?? 1 / 0;
  if (h > 0 && h * 0.8 < u && h * h < s) {
    const f = yi(r, l, "end", i);
    f !== null && f < r.length - 1 && (r = r.slice(0, f + 1));
    const m = r.length - 1;
    r[m] = {
      ...r[m],
      x: l.x,
      y: l.y
    }, a = !0;
  } else if (d && u < h) {
    const f = Ze(r, e, "end", s, i);
    f && (r = f.trimmed, a = !0, n.includes(f.strokeId) || n.push(f.strokeId));
  }
  const p = Ze(r, e, "start", s, i);
  return p && (r = p.trimmed, o = !0, n.includes(p.strokeId) || n.push(p.strokeId)), {
    snapped: o || a,
    end: o && a ? "both" : o ? "start" : a ? "end" : "none",
    targetStrokeIds: n,
    correctedRaw: r
  };
}
function Ze(t, e, i, s, r) {
  const n = i === "start" ? t[0] : t[t.length - 1], o = Si(n, e, s);
  if (!o) return null;
  const a = yi(t, {
    x: o.x,
    y: o.y,
    t: n.t,
    pressure: n.pressure
  }, i, r);
  let c = t.map((h) => ({ ...h })), l = 0;
  if (a !== null && (i === "start" && a > 0 ? (c = c.slice(a), l = a) : i === "end" && a < t.length - 1 && (c = c.slice(0, a + 1), l = t.length - 1 - a)), i === "start") c[0] = {
    ...c[0],
    x: o.x,
    y: o.y
  };
  else {
    const h = c.length - 1;
    c[h] = {
      ...c[h],
      x: o.x,
      y: o.y
    };
  }
  return {
    trimmed: c,
    trimCount: l,
    dist: o.dist,
    strokeId: o.strokeId
  };
}
function yi(t, e, i, s) {
  const r = Math.ceil(t.length * 0.4);
  let n = null, o = s * s;
  for (let a = 0; a < r; a++) {
    const c = i === "start" ? a : t.length - 1 - a, l = t[c], h = l.x - e.x, d = l.y - e.y, u = h * h + d * d;
    u < o && (o = u, n = c);
  }
  return n;
}
function Si(t, e, i) {
  let s = null, r = i;
  for (const n of e) for (const o of n.raw) {
    const a = o.x - t.x, c = o.y - t.y, l = a * a + c * c;
    l < r && (r = l, s = {
      x: o.x,
      y: o.y,
      dist: Math.sqrt(l),
      strokeId: n.id
    });
  }
  return s;
}
function $r(t, e) {
  return Math.sqrt((t.x - e.x) ** 2 + (t.y - e.y) ** 2);
}
var qr = 5, Yr = 0.6, Zr = 2, Kr = 120 * Math.PI / 180, Jr = 5;
function Qr(t, e = Yr) {
  if (t.length < qr) return {
    trimmed: !1,
    pointsRemoved: 0,
    correctedRaw: [...t]
  };
  const i = [], s = [];
  for (let o = 1; o < t.length; o++) {
    const a = t[o].x - t[o - 1].x, c = t[o].y - t[o - 1].y, l = Math.max(t[o].t - t[o - 1].t, 1), h = Math.sqrt(a * a + c * c) / l, d = Math.atan2(c, a);
    i.push(h), s.push(d);
  }
  const r = Math.min(Jr, Math.floor(t.length * 0.2));
  if (r < 2) return {
    trimmed: !1,
    pointsRemoved: 0,
    correctedRaw: [...t]
  };
  const n = Math.max(r, Math.ceil(t.length * e));
  for (let o = t.length - 2; o >= n; o--) {
    const a = tn(i, o - r, o);
    if (a <= 0 || i[o] <= a * Zr) continue;
    const c = Math.min(s.length, o + r);
    if (c - o < 2) continue;
    const l = Ke(s, Math.max(0, o - r), o), h = Ke(s, o, c);
    if (Math.abs(en(h - l)) < Kr) continue;
    const d = t.slice(0, o + 1).map((u) => ({ ...u }));
    return {
      trimmed: !0,
      pointsRemoved: t.length - d.length,
      correctedRaw: d
    };
  }
  return {
    trimmed: !1,
    pointsRemoved: 0,
    correctedRaw: [...t]
  };
}
function tn(t, e, i) {
  const s = Math.max(0, e), r = Math.min(t.length, i);
  if (r <= s) return 0;
  let n = 0;
  for (let o = s; o < r; o++) n += t[o];
  return n / (r - s);
}
function Ke(t, e, i) {
  const s = Math.max(0, e), r = Math.min(t.length, i);
  if (r <= s) return 0;
  let n = 0, o = 0;
  for (let a = s; a < r; a++)
    n += Math.sin(t[a]), o += Math.cos(t[a]);
  return Math.atan2(n, o);
}
function en(t) {
  for (; t > Math.PI; ) t -= 2 * Math.PI;
  for (; t < -Math.PI; ) t += 2 * Math.PI;
  return t;
}
var sn = {
  snapThreshold: 15,
  endpointSnap: !0,
  overshootTrim: !0
}, rn = class {
  correctRaw(t, e, i) {
    const s = {
      ...sn,
      ...i
    }, r = [];
    let n = t.map((a) => ({ ...a }));
    const o = this.checkSelfClosing(n, s.snapThreshold);
    if (s.overshootTrim && !o) {
      const a = Qr(n);
      a.trimmed && (n = a.correctedRaw, r.push("overshoot-trim"));
    }
    if (s.endpointSnap) {
      const a = Vr(n, e, s.snapThreshold);
      a.snapped && (n = a.correctedRaw, r.push("endpoint-snap"));
    }
    return {
      correctedRaw: n,
      corrections: r
    };
  }
  correctAndSmooth(t, e, i, s) {
    const { correctedRaw: r, corrections: n } = this.correctRaw(t, e, s);
    return {
      correctedRaw: r,
      correctedSmoothed: n.length > 0 ? i.processBatch(r) : i.processBatch(t),
      corrections: n
    };
  }
  checkSelfClosing(t, e) {
    if (t.length < 6) return !1;
    const i = t[0], s = t[t.length - 1], r = s.x - i.x, n = s.y - i.y, o = Math.sqrt(r * r + n * n);
    if (o < e) return !0;
    let a = 0;
    for (let c = 1; c < t.length; c++) {
      const l = t[c].x - t[c - 1].x, h = t[c].y - t[c - 1].y;
      a += Math.sqrt(l * l + h * h);
    }
    return a === 0 ? !1 : o / a < 0.2;
  }
};
function nn(t, e, i, s = 12) {
  const r = new OffscreenCanvas(e, i), n = r.getContext("2d");
  n.fillStyle = "#000000", n.fillRect(0, 0, e, i), n.strokeStyle = "#ffffff", n.lineWidth = 4, n.strokeRect(1, 1, e - 2, i - 2), n.lineCap = "round", n.lineJoin = "round";
  for (const o of t) {
    const a = o.smoothed;
    if (!(a.length < 2)) {
      n.lineWidth = 12 + s * 2, n.beginPath(), n.moveTo(a[0].x, a[0].y);
      for (let c = 1; c < a.length; c++) n.lineTo(a[c].x, a[c].y);
      n.stroke();
    }
  }
  return r;
}
function on(t, e, i, s) {
  const { width: r, height: n, data: o } = t;
  if ((o[(i * r + e) * 4] ?? 0) > 128) return null;
  const a = new ImageData(r, n), c = a.data, l = new Uint8Array(r * n), h = [[e, i]], d = (p, f) => {
    if (p < 0 || p >= r || f < 0 || f >= n) return !1;
    const m = f * r + p;
    return l[m] ? !1 : (o[m * 4] ?? 0) <= 128;
  }, u = (p, f) => {
    const m = f * r + p;
    l[m] = 1;
    const y = m * 4;
    c[y] = s.r, c[y + 1] = s.g, c[y + 2] = s.b, c[y + 3] = s.a;
  };
  for (; h.length > 0; ) {
    const [p, f] = h.pop();
    if (!d(p, f)) continue;
    let m = p;
    for (; m > 0 && d(m - 1, f); ) m--;
    let y = p;
    for (; y < r - 1 && d(y + 1, f); ) y++;
    for (let S = m; S <= y; S++) u(S, f);
    for (const S of [-1, 1]) {
      const M = f + S;
      if (M < 0 || M >= n) continue;
      let w = m;
      for (; w <= y; ) {
        for (; w <= y && !d(w, M); ) w++;
        if (w > y) break;
        for (h.push([w, M]); w <= y && d(w, M); ) w++;
      }
    }
  }
  return a;
}
function an(t, e) {
  const { width: i, height: s } = t, r = t.data, n = new Uint8Array(i * s);
  for (let f = 0; f < n.length; f++) n[f] = r[f * 4 + 3] > 0 ? 1 : 0;
  const o = new Uint8Array(i * s);
  for (let f = 0; f < s; f++) {
    const m = f * i;
    let y = 0;
    for (let S = 0; S <= e && S < i; S++) y += n[m + S];
    for (let S = 0; S < i; S++) {
      y > 0 && (o[m + S] = 1);
      const M = S - e, w = S + e + 1;
      M >= 0 && (y -= n[m + M]), w < i && (y += n[m + w]);
    }
  }
  const a = new Uint8Array(i * s);
  for (let f = 0; f < i; f++) {
    let m = 0;
    for (let y = 0; y <= e && y < s; y++) m += o[y * i + f];
    for (let y = 0; y < s; y++) {
      m > 0 && (a[y * i + f] = 1);
      const S = y - e, M = y + e + 1;
      S >= 0 && (m -= o[S * i + f]), M < s && (m += o[M * i + f]);
    }
  }
  let c = 0, l = 0, h = 0, d = 255;
  for (let f = 0; f < n.length; f++) if (n[f]) {
    c = r[f * 4], l = r[f * 4 + 1], h = r[f * 4 + 2], d = r[f * 4 + 3];
    break;
  }
  const u = new ImageData(i, s), p = u.data;
  for (let f = 0; f < a.length; f++) if (a[f]) {
    const m = f * 4;
    p[m] = c, p[m + 1] = l, p[m + 2] = h, p[m + 3] = d;
  }
  return u;
}
async function Uo(t, e, i, s, r, n, o = 12) {
  if (t.length === 0) return null;
  const a = Math.max(0, Math.min(e - 1, Math.round(s))), c = Math.max(0, Math.min(i - 1, Math.round(r))), l = nn(t, e, i, o).getContext("2d").getImageData(0, 0, e, i), h = new OffscreenCanvas(1, 1).getContext("2d");
  h.fillStyle = n, h.fillRect(0, 0, 1, 1);
  const d = h.getImageData(0, 0, 1, 1).data, u = on(l, a, c, {
    r: d[0] ?? 0,
    g: d[1] ?? 0,
    b: d[2] ?? 0,
    a: 255
  });
  if (!u) return null;
  const p = an(u, o + 4), f = e * i;
  let m = 0;
  const y = p.data;
  for (let S = 3; S < y.length; S += 4) y[S] > 0 && m++;
  return m / f > 0.4 ? (console.warn("[FloodFill] Fill covers", Math.round(m / f * 100) + "% of canvas — likely leaked, cancelling"), null) : createImageBitmap(p);
}
var V = null, vi = null, wi = null, Xt = null, xe = null;
async function ln() {
  if (V) return !0;
  try {
    const [t, e, i, s, r] = await Promise.all([
      import("three/webgpu"),
      import("three/examples/jsm/geometries/TextGeometry.js"),
      import("three/examples/jsm/loaders/FontLoader.js"),
      import("three/tsl"),
      import("three/addons/tsl/display/BloomNode.js")
    ]);
    return V = t, vi = e.TextGeometry, wi = i.Font, Xt = s, xe = r.bloom, !0;
  } catch (t) {
    return console.error("[Hologram3DRenderer] Failed to load Three.js WebGPU:", t), !1;
  }
}
var cn = ["/fonts/helvetiker_bold.typeface.json", "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/fonts/helvetiker_bold.typeface.json"], hn = '"Apple SD Gothic Neo", "Nanum Gothic", "Malgun Gothic", "Noto Sans KR", sans-serif';
function dn(t) {
  const e = t.codePointAt(0) ?? 0;
  return e >= 44032 && e <= 55215 || e >= 4352 && e <= 4607 || e >= 12592 && e <= 12687 || e >= 19968 && e <= 40959 || e >= 12352 && e <= 12543;
}
var Ho = class {
  canvas;
  destroyed = !1;
  renderer = null;
  postProcessing = null;
  scene = null;
  camera = null;
  charContainer = null;
  pivotGroup = null;
  loadedFont = null;
  charMeshes = /* @__PURE__ */ new Map();
  chars = [];
  rotX = 0;
  rotY = 0;
  rotZ = 0;
  zoom = 1;
  transition = 0;
  spread = 1;
  handActive = !1;
  enabled = !0;
  movedChars = /* @__PURE__ */ new Map();
  activeDragId = null;
  startTime = performance.now();
  _isAvailable = !1;
  get isAvailable() {
    return this._isAvailable;
  }
  ready;
  constructor(t) {
    this.canvas = t.canvas, this.ready = this.init();
  }
  setText(t) {
    this.chars = t;
  }
  setRotation(t, e, i) {
    this.rotX = t, this.rotY = e, i !== void 0 && (this.rotZ = i);
  }
  setZoom(t) {
    this.zoom = Math.max(0.3, Math.min(3, t));
  }
  setTransition(t) {
    this.transition = Math.max(0, Math.min(1, t));
  }
  setSpread(t) {
    this.spread = Math.max(0, Math.min(6, t));
  }
  setHandActive(t) {
    this.handActive = t;
  }
  setEnabled(t) {
    this.enabled = t;
  }
  grabChar(t, e, i) {
    this.movedChars.set(t, {
      x: e,
      y: i
    }), this.activeDragId = t;
  }
  releaseChar(t) {
    this.activeDragId = null;
  }
  resetTransform() {
    this.rotX = 0, this.rotY = 0, this.rotZ = 0, this.zoom = 1, this.spread = 1, this.movedChars.clear(), this.activeDragId = null;
  }
  hitTestChar(t, e, i) {
    if (!V || !this.camera || !this.canvas) return this.hitTestCharFallback(t, e, i);
    const s = this.canvas.clientWidth, r = this.canvas.clientHeight, n = t / s * 2 - 1, o = -(e / r) * 2 + 1, a = new V.Raycaster();
    a.setFromCamera(new V.Vector2(n, o), this.camera);
    const c = [], l = this.chars.filter((u) => !u.isDeleting);
    for (const u of l) {
      const p = this.charMeshes.get(u.id);
      p && c.push({
        id: u.id,
        group: p.group
      });
    }
    const h = c.map((u) => u.group), d = a.intersectObjects(h, !0);
    if (d.length > 0) {
      const u = d[0];
      for (const { id: p, group: f } of c) {
        let m = !1;
        if (f.traverse((y) => {
          y === u.object && (m = !0);
        }), m) return {
          id: p,
          dist: u.distance
        };
      }
    }
    return this.hitTestCharFallback(t, e, i);
  }
  hitTestCharFallback(t, e, i) {
    const s = this.chars.filter((n) => !n.isDeleting);
    let r = null;
    for (const n of s) {
      const o = this.movedChars.get(n.id), a = o?.x ?? n.x, c = o?.y ?? n.y, l = Math.sqrt((t - a) ** 2 + (e - c) ** 2);
      l < i && (!r || l < r.dist) && (r = {
        id: n.id,
        dist: l
      });
    }
    return r;
  }
  renderFrame() {
    if (this.destroyed || !this.canvas || !this.renderer || !this.postProcessing || !this.scene || !this.camera || !this.charContainer) return;
    const t = this.canvas, e = this.renderer, i = this.camera, s = this.charContainer, r = e.getPixelRatio(), n = t.clientWidth, o = t.clientHeight;
    if ((t.width !== Math.floor(n * r) || t.height !== Math.floor(o * r)) && (e.setSize(n, o, !1), i.aspect = n / o, i.updateProjectionMatrix()), !this.enabled || this.transition < 1e-3) {
      e.setClearColor(0, 0), e.clear();
      return;
    }
    const a = performance.now(), c = (a - this.startTime) * 1e-3, l = this.transition, h = this.chars.filter((S) => !S.isDeleting), d = Math.min(h.length, 20), u = this.spread, p = /* @__PURE__ */ new Set();
    for (let S = 0; S < d; S++) {
      const M = h[S];
      p.add(M.id);
      let w = this.charMeshes.get(M.id);
      if (!w) {
        const G = this.createCharMesh(M.char, c, l);
        if (!G) continue;
        w = {
          group: G.group,
          frontMat: G.frontMat,
          sideMat: G.sideMat,
          uTime: G.uTime,
          uTransition: G.uTransition,
          sideUTime: G.sideUTime,
          sideUTransition: G.sideUTransition
        }, this.charMeshes.set(M.id, w), s.add(w.group);
      }
      w.uTime.value = c, w.uTransition.value = l, w.sideUTime.value = c, w.sideUTransition.value = l;
      const _ = 6 / this.zoom, N = 35 * Math.PI / 180, z = _ * Math.tan(N / 2), C = z * i.aspect, I = n, H = o, B = this.movedChars.get(M.id), O = this.activeDragId === M.id, Y = B?.x ?? M.x, $ = B?.y ?? M.y, ut = Y / I * 2 - 1, mt = -($ / H * 2 - 1), st = M.height / H * z * 2, P = Math.max(st, 0.5), U = a - M.entryTime, j = Math.min(U / 600, 1), K = j * (j < 1 ? 1 + (1 - j) * 0.35 * Math.sin(j * Math.PI * 2.5) : 1);
      if (O) {
        const G = ut * C, ft = mt * z, nt = s.rotation.x, pt = s.rotation.y, wt = Math.cos(-pt), Ht = Math.sin(-pt), g = G * wt, v = -G * Ht, b = Math.cos(-nt), k = Math.sin(-nt), A = ft * b - v * k, L = ft * k + v * b;
        w.group.position.set(g, A, L), w.group.rotation.set(-nt, -pt, -s.rotation.z), w.group.scale.setScalar(P * 1.2 * l), w.uTransition.value = l, w.sideUTransition.value = l;
      } else {
        let G = 0, ft = 0;
        for (let k = 0; k < d; k++) {
          const A = this.movedChars.get(h[k].id);
          G += (A?.x ?? h[k].x) / I * 2 - 1, ft += -((A?.y ?? h[k].y) / H * 2 - 1);
        }
        const nt = G / d, pt = ft / d, wt = (nt + (ut - nt) * u) * C, Ht = (pt + (mt - pt) * u) * z, g = (d - 1) / 2, v = -(S - g) * 0.6 * u;
        w.group.position.set(wt, Ht, v), w.group.rotation.set(0, 0, 0), w.group.scale.setScalar(P * K * l);
        const b = Math.min(U / 400, 1);
        w.uTransition.value = l * b, w.sideUTransition.value = l * b;
      }
    }
    for (const [S, M] of this.charMeshes) p.has(S) || (s.remove(M.group), M.group.traverse((w) => {
      if (w.geometry && w.geometry.dispose(), w.material) {
        const _ = w.material;
        Array.isArray(_) ? _.forEach((N) => N.dispose()) : _.dispose();
      }
    }), this.charMeshes.delete(S));
    const f = !this.enabled && l > 0, m = this.handActive || f ? 0 : Math.sin(c * 0.5) * 0.3, y = this.handActive || f ? 0 : Math.sin(c * 0.3) * 0.12;
    if (s.rotation.x = this.rotX + y, s.rotation.y = this.rotY + m, s.rotation.z = this.rotZ, this.pivotGroup) {
      const S = this.pivotGroup._pivotMats, M = this.handActive ? 0.25 : 0;
      for (const w of S) w.opacity += (M - w.opacity) * 0.1;
      this.pivotGroup.visible = S[0].opacity > 0.01;
    }
    i.position.z = 6 / this.zoom, this.postProcessing.render();
  }
  dispose() {
    this.destroyed = !0;
    for (const [, t] of this.charMeshes) t.group.traverse((e) => {
      if (e.geometry && e.geometry.dispose(), e.material) {
        const i = e.material;
        Array.isArray(i) ? i.forEach((s) => s.dispose()) : i.dispose();
      }
    });
    this.charMeshes.clear(), this.renderer && (this.renderer.dispose(), this.renderer = null);
  }
  async init() {
    try {
      if (!await ln() || this.destroyed || !V || !Xt || !xe) return !1;
      if (this.scene = new V.Scene(), this.camera = new V.PerspectiveCamera(35, 1, 0.1, 100), this.camera.position.set(0, 0, 6), this.renderer = new V.WebGPURenderer({
        canvas: this.canvas,
        alpha: !0,
        antialias: !0
      }), this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)), this.renderer.setClearColor(0, 0), this.renderer.sortObjects = !0, await this.renderer.init(), this.destroyed)
        return this.renderer.dispose(), !1;
      const { pass: t } = Xt, e = t(this.scene, this.camera).getTextureNode("output"), i = xe(e);
      i.threshold.value = 0.1, i.strength.value = 2.8, i.radius.value = 0.6, this.postProcessing = new V.PostProcessing(this.renderer), this.postProcessing.outputNode = e.add(i);
      for (const s of cn) try {
        const r = await fetch(s);
        if (!r.ok) continue;
        const n = await r.json();
        this.loadedFont = new wi(n);
        break;
      } catch {
      }
      if (this.destroyed || !this.loadedFont) return !1;
      this.charContainer = new V.Group(), this.scene.add(this.charContainer), this.pivotGroup = new V.Group(), this.scene.add(this.pivotGroup);
      {
        const s = new V.MeshBasicMaterial({
          color: 48127,
          transparent: !0,
          opacity: 0,
          depthWrite: !1
        }), r = new V.PlaneGeometry(0.6, 8e-3);
        this.pivotGroup.add(new V.Mesh(r, s));
        const n = new V.PlaneGeometry(8e-3, 0.6);
        this.pivotGroup.add(new V.Mesh(n, s));
        const o = new V.CircleGeometry(0.04, 16), a = new V.MeshBasicMaterial({
          color: 48127,
          transparent: !0,
          opacity: 0,
          depthWrite: !1
        });
        this.pivotGroup.add(new V.Mesh(o, a)), this.pivotGroup._pivotMats = [s, a];
      }
      return this.startTime = performance.now(), this._isAvailable = !0, !0;
    } catch (t) {
      return console.error("[Hologram3DRenderer] init failed:", t), !1;
    }
  }
  createHologramMaterial(t) {
    if (!V || !Xt) return null;
    const { Fn: e, float: i, vec3: s, uniform: r, color: n, positionWorld: o, normalWorld: a, cameraPosition: c, sin: l, smoothstep: h, abs: d, dot: u, pow: p, clamp: f } = Xt, m = r(0), y = r(0), S = new V.Color(48127), M = e(() => {
      const z = d(u(a, c.sub(o).normalize()));
      return p(i(1).sub(z), i(3));
    }), w = e(() => {
      const z = l(o.y.mul(60).sub(m.mul(4))).mul(0.5).add(0.5);
      return h(i(0.2), i(0.8), z).mul(0.25);
    }), _ = e(() => l(m.mul(6)).mul(0.06).add(l(m.mul(11.3)).mul(0.04))), N = new V.MeshStandardNodeMaterial();
    return N.transparent = !0, N.depthWrite = !1, N.side = V.FrontSide, t ? (N.colorNode = n(S).add(M().mul(0.8)).add(s(i(0.1), i(0.2), i(0.3))), N.opacityNode = f(i(0.92).add(M().mul(0.08)).sub(w()).add(_()).mul(y), i(0), i(1))) : (N.colorNode = n(S).mul(0.45).add(s(i(0.03), i(0.08), i(0.15))).add(M().mul(0.5)), N.opacityNode = f(i(0.7).add(M().mul(0.2)).sub(w().mul(0.4)).add(_()).mul(y), i(0), i(1))), N.emissiveNode = n(S).mul(M().mul(0.7).add(0.35)), {
      material: N,
      uTime: m,
      uTransition: y
    };
  }
  createCharMesh(t, e, i) {
    if (!V || !this.loadedFont) return null;
    const s = this.createHologramMaterial(!0), r = this.createHologramMaterial(!1);
    if (!s || !r) return null;
    if (dn(t)) return this.createTextureCharMesh(t, s, r);
    const n = new vi(t, {
      font: this.loadedFont,
      size: 1,
      depth: 0.35,
      curveSegments: 6,
      bevelEnabled: !0,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3
    });
    n.computeBoundingBox();
    const o = n.boundingBox, a = (o.max.x + o.min.x) / 2, c = (o.max.y + o.min.y) / 2, l = (o.max.z + o.min.z) / 2;
    n.translate(-a, -c, -l);
    const h = new V.Mesh(n, [s.material, r.material]), d = new V.Group();
    return d.add(h), {
      group: d,
      frontMat: s.material,
      sideMat: r.material,
      uTime: s.uTime,
      uTransition: s.uTransition,
      sideUTime: r.uTime,
      sideUTransition: r.uTransition
    };
  }
  createTextureCharMesh(t, e, i) {
    if (!V) return null;
    const s = 128, r = document.createElement("canvas");
    r.width = s, r.height = s;
    const n = r.getContext("2d");
    if (!n) return null;
    n.clearRect(0, 0, s, s), n.fillStyle = "#ffffff", n.font = `bold ${s * 0.7}px ${hn}`, n.textAlign = "center", n.textBaseline = "middle", n.fillText(t, s / 2, s / 2);
    const o = new V.CanvasTexture(r);
    o.needsUpdate = !0;
    const a = e.material.clone();
    a.transparent = !0, a.alphaMap = o, a.alphaTest = 0.1;
    const c = new V.BoxGeometry(1.2, 1.2, 0.35), l = new V.Mesh(c, [
      i.material,
      i.material,
      i.material,
      i.material,
      a,
      e.material
    ]), h = new V.Group();
    return h.add(l), {
      group: h,
      frontMat: e.material,
      sideMat: i.material,
      uTime: e.uTime,
      uTransition: e.uTransition,
      sideUTime: i.uTime,
      sideUTransition: i.uTransition
    };
  }
}, Go = class {
  rotX = 0;
  rotY = 0;
  rotZ = 0;
  spread = 1;
  baseline = null;
  smoothMidX = 0.5;
  smoothMidY = 0.5;
  twoHandEntryTime = 0;
  bothFistsPrev = !1;
  grabbedCharId = null;
  midpointSmoothing;
  deadZone;
  rotSpeed;
  fps;
  pinchThreshold;
  spreadSmoothing;
  rotZSmoothing;
  maxZDelta;
  twoHandStableDelay;
  hitTestFn = null;
  constructor(t) {
    this.midpointSmoothing = t?.midpointSmoothing ?? 0.08, this.deadZone = t?.deadZone ?? 0.08, this.rotSpeed = t?.rotSpeed ?? 8, this.fps = t?.fps ?? 30, this.pinchThreshold = t?.pinchThreshold ?? 0.06, this.spreadSmoothing = t?.spreadSmoothing ?? 0.4, this.rotZSmoothing = t?.rotZSmoothing ?? 0.12, this.maxZDelta = t?.maxZDelta ?? 0.5, this.twoHandStableDelay = t?.twoHandStableDelay ?? 200;
  }
  setHitTestFn(t) {
    this.hitTestFn = t;
  }
  reset() {
    this.rotX = 0, this.rotY = 0, this.rotZ = 0, this.spread = 1, this.baseline = null, this.smoothMidX = 0.5, this.smoothMidY = 0.5, this.twoHandEntryTime = 0, this.bothFistsPrev = !1, this.grabbedCharId = null;
  }
  update(t, e, i, s, r = !0) {
    const n = new oe(t).folded("index", "middle", "ring", "pinky"), o = e !== null && e.length >= 21, a = performance.now();
    let c = !1;
    if (o) {
      this.grabbedCharId !== null && (this.grabbedCharId = null);
      const p = t[0], f = e[0], m = new oe(e).folded("index", "middle", "ring", "pinky"), y = n && m;
      if (y && !this.bothFistsPrev && (c = !0), this.bothFistsPrev = y, !y) {
        const S = t[9], M = e[9], w = (S.x + M.x) / 2, _ = (S.y + M.y) / 2, N = Math.abs(p.x - f.x), z = Math.atan2(f.y - p.y, f.x - p.x);
        if (this.baseline === null && (this.baseline = {
          dist: N,
          angle: z,
          spread: this.spread,
          rotZ: this.rotZ
        }, this.smoothMidX = w, this.smoothMidY = _, this.twoHandEntryTime = a), a - this.twoHandEntryTime > this.twoHandStableDelay) {
          const C = this.baseline, I = N / C.dist * C.spread;
          this.spread += (Math.max(0.1, Math.min(5, I)) - this.spread) * this.spreadSmoothing, this.smoothMidX += (w - this.smoothMidX) * this.midpointSmoothing, this.smoothMidY += (_ - this.smoothMidY) * this.midpointSmoothing;
          const H = this.smoothMidX - 0.5, B = this.smoothMidY - 0.5;
          if (Math.abs(H) > this.deadZone) {
            const $ = H > 0 ? H - this.deadZone : H + this.deadZone;
            this.rotY += $ * this.rotSpeed / this.fps;
          }
          if (Math.abs(B) > this.deadZone) {
            const $ = B > 0 ? B - this.deadZone : B + this.deadZone;
            this.rotX += $ * this.rotSpeed / this.fps;
          }
          let O = z - C.angle;
          O > Math.PI && (O -= 2 * Math.PI), O < -Math.PI && (O += 2 * Math.PI), O = Math.max(-this.maxZDelta, Math.min(this.maxZDelta, O));
          const Y = C.rotZ + O;
          this.rotZ += (Y - this.rotZ) * this.rotZSmoothing;
        }
      }
      return {
        rotX: this.rotX,
        rotY: this.rotY,
        rotZ: this.rotZ,
        spread: this.spread,
        handsActive: !0,
        grabbedCharId: null,
        grabPosition: null,
        didReset: c
      };
    }
    this.baseline = null, this.bothFistsPrev = !1;
    const l = t[4], h = t[8], d = Math.sqrt((l.x - h.x) ** 2 + (l.y - h.y) ** 2) < this.pinchThreshold;
    let u = null;
    if (d) {
      const p = (l.x + h.x) / 2, f = (l.y + h.y) / 2, m = r ? (1 - p) * i : p * i, y = f * s;
      if (this.grabbedCharId === null && this.hitTestFn) {
        const S = this.hitTestFn(m, y, 100);
        S && (this.grabbedCharId = S.id);
      }
      this.grabbedCharId !== null && (u = {
        x: m,
        y
      });
    } else this.grabbedCharId = null;
    return {
      rotX: this.rotX,
      rotY: this.rotY,
      rotZ: this.rotZ,
      spread: this.spread,
      handsActive: !1,
      grabbedCharId: this.grabbedCharId,
      grabPosition: u,
      didReset: !1
    };
  }
  getRotation() {
    return {
      rotX: this.rotX,
      rotY: this.rotY,
      rotZ: this.rotZ
    };
  }
  getSpread() {
    return this.spread;
  }
  setRotation(t, e, i) {
    this.rotX = t, this.rotY = e, this.rotZ = i;
  }
  setSpread(t) {
    this.spread = t;
  }
}, un = class {
  _enabled = !1;
  listeners = /* @__PURE__ */ new Set();
  get enabled() {
    return this._enabled;
  }
  enable() {
    this._enabled = !0;
  }
  disable() {
    this._enabled = !1;
  }
  subscribe(t) {
    return this.listeners.add(t), () => {
      this.listeners.delete(t);
    };
  }
  emit(t) {
    if (this._enabled)
      for (const e of this.listeners) try {
        e(t);
      } catch {
      }
  }
}, vt = new un(), fn = class {
  canvas = null;
  active = !1;
  pointerDown = !1;
  onPoint;
  onPenState;
  handlePointerDown = null;
  handlePointerMove = null;
  handlePointerUp = null;
  constructor(t, e) {
    this.onPoint = t, this.onPenState = e;
  }
  start(t) {
    this.active || (this.canvas = t, this.active = !0, this.bindEvents(t));
  }
  stop() {
    !this.active || !this.canvas || (this.unbindEvents(this.canvas), this.canvas = null, this.active = !1, this.pointerDown = !1);
  }
  isActive() {
    return this.active;
  }
  bindEvents(t) {
    this.handlePointerDown = (e) => this.onDown(e), this.handlePointerMove = (e) => this.onMove(e), this.handlePointerUp = () => this.onUp(), t.addEventListener("pointerdown", this.handlePointerDown), t.addEventListener("pointermove", this.handlePointerMove), t.addEventListener("pointerup", this.handlePointerUp), t.addEventListener("pointerleave", this.handlePointerUp);
  }
  unbindEvents(t) {
    this.handlePointerDown && t.removeEventListener("pointerdown", this.handlePointerDown), this.handlePointerMove && t.removeEventListener("pointermove", this.handlePointerMove), this.handlePointerUp && (t.removeEventListener("pointerup", this.handlePointerUp), t.removeEventListener("pointerleave", this.handlePointerUp));
  }
  onDown(t) {
    this.pointerDown = !0, this.onPenState(!0), this.emitPoint(t);
  }
  onMove(t) {
    this.pointerDown && this.emitPoint(t);
  }
  onUp() {
    this.pointerDown && (this.pointerDown = !1, this.onPenState(!1));
  }
  emitPoint(t) {
    if (!this.canvas) return;
    const e = this.canvas.getBoundingClientRect(), i = typeof window < "u" && window.devicePixelRatio || 1, s = {
      x: (t.clientX - e.left) * i,
      y: (t.clientY - e.top) * i,
      t: performance.now(),
      source: t.pointerType === "touch" ? "touch" : "mouse",
      pressure: t.pressure > 0 ? t.pressure : void 0
    };
    this.onPoint(s);
  }
}, pn = class {
  mouseCapture = null;
  cameraCapture = null;
  onPoint = () => {
  };
  onPenState = () => {
  };
  onError = () => {
  };
  onSuccess = () => {
  };
  alwaysDrawMode = !1;
  workerUrl = null;
  onHandVisibility = null;
  setPointCallback(t) {
    this.onPoint = t;
  }
  setPenStateCallback(t) {
    this.onPenState = t;
  }
  setErrorCallback(t) {
    this.onError = t;
  }
  setSuccessCallback(t) {
    this.onSuccess = t;
  }
  attachMouse(t) {
    this.detachMouse(), this.mouseCapture = new fn((e) => this.onPoint(e), (e) => this.onPenState(e)), this.mouseCapture.start(t);
  }
  attachCamera(t) {
    this.detachCamera(), this.cameraCapture = new Nr((e) => this.onPoint(e), (e) => this.onPenState(e), (e) => this.onError(e), () => this.onSuccess()), this.workerUrl && this.cameraCapture.setWorkerUrl(this.workerUrl), this.alwaysDrawMode && this.cameraCapture.setAlwaysDrawMode(!0), this.onHandVisibility && this.cameraCapture.setHandVisibilityCallback(this.onHandVisibility), this.cameraCapture.start(t);
  }
  detachMouse() {
    this.mouseCapture && (this.mouseCapture.stop(), this.mouseCapture = null);
  }
  detachCamera() {
    this.cameraCapture && (this.cameraCapture.stop(), this.cameraCapture = null);
  }
  detachAll() {
    this.detachMouse(), this.detachCamera();
  }
  setHandVisibilityCallback(t) {
    this.onHandVisibility = t, this.cameraCapture?.setHandVisibilityCallback(t);
  }
  setWorkerUrl(t) {
    this.workerUrl = t, this.cameraCapture?.setWorkerUrl(t);
  }
  setCameraAlwaysDrawMode(t) {
    this.alwaysDrawMode = t, this.cameraCapture?.setAlwaysDrawMode(t);
  }
  setDrawingPaused(t) {
    this.cameraCapture?.setDrawingPaused(t);
  }
  setTransitMoveCallback(t) {
    this.cameraCapture?.setTransitMoveCallback(t);
  }
  setSecondHandCallbacks(t, e) {
    this.cameraCapture?.setSecondHandCallbacks(t, e);
  }
  hasActiveSource() {
    return (this.mouseCapture?.isActive() ?? !1) || (this.cameraCapture?.isActive() ?? !1);
  }
  getCameraCapture() {
    return this.cameraCapture;
  }
}, mn = 0.5, gn = class {
  name = "capture";
  createStrokePoint(t) {
    return {
      x: t.x,
      y: t.y,
      t: t.t,
      pressure: t.pressure ?? mn
    };
  }
  process(t) {
    return { ...t };
  }
  reset() {
  }
}, Kt = 1, Jt = 7e-3, Qt = 1, Je = 0.3, Qe = 1e-3, ti = 0.7, yn = class {
  name = "stabilize";
  inputSource = "mouse";
  filterX;
  filterY;
  constructor() {
    this.filterX = new Mt(Kt, Jt, Qt), this.filterY = new Mt(Kt, Jt, Qt);
  }
  setInputSource(t) {
    this.inputSource !== t && (this.inputSource = t, t === "camera" ? (this.filterX = new Mt(Je, Qe, ti), this.filterY = new Mt(Je, Qe, ti)) : (this.filterX = new Mt(Kt, Jt, Qt), this.filterY = new Mt(Kt, Jt, Qt)));
  }
  process(t) {
    return {
      x: this.filterX.filter(t.x, t.t),
      y: this.filterY.filter(t.y, t.t),
      t: t.t,
      pressure: t.pressure
    };
  }
  reset() {
    this.filterX.reset(), this.filterY.reset();
  }
}, Sn = 1.7, vn = 0.8, wn = 0.15, ei = 1, An = 0.5, bn = 16, kn = 8, Mn = 0.15, Cn = class {
  name = "pressure";
  prevPoint = null;
  inputSource = "mouse";
  setInputSource(t) {
    this.inputSource = t;
  }
  process(t) {
    const e = this.calculatePressure(t);
    return this.prevPoint = t, {
      ...t,
      pressure: e
    };
  }
  reset() {
    this.prevPoint = null;
  }
  calculatePressure(t) {
    if (!this.prevPoint) return An;
    const e = t.x - this.prevPoint.x, i = t.y - this.prevPoint.y, s = t.t - this.prevPoint.t || bn;
    return Li(ei - Math.sqrt(e * e + i * i) / s * (this.inputSource === "camera" ? vn : Sn), wn, ei);
  }
}, Ln = class {
  name = "pressure-taper";
  processBatch(t) {
    const e = t.map((i) => ({ ...i }));
    return xn(e), e;
  }
  reset() {
  }
};
function xn(t) {
  const e = Math.min(kn, Math.floor(t.length * Mn));
  if (e !== 0)
    for (let i = 0; i < e; i++) {
      const s = i / e, r = s * s;
      t[i].pressure *= r, t[t.length - 1 - i].pressure *= r;
    }
}
var En = 3, Tn = 1e4, Pn = class {
  name = "segment";
  currentPoints = [];
  isDrawing = !1;
  droppedThisStroke = 0;
  capWarned = !1;
  process(t) {
    return this.isDrawing && (this.currentPoints.length < 1e4 ? this.currentPoints.push({ ...t }) : (this.droppedThisStroke += 1, this.capWarned || (console.warn(`[SegmentStage] stroke exceeded MAX_POINTS=${Tn}; further points will be dropped for this stroke.`), this.capWarned = !0))), t;
  }
  penDown() {
    this.isDrawing = !0, this.currentPoints = [], this.droppedThisStroke = 0, this.capWarned = !1;
  }
  penUp() {
    this.isDrawing = !1;
    const t = this.currentPoints;
    return this.currentPoints = [], t.length < En ? null : t;
  }
  getCurrentPoints() {
    return this.currentPoints;
  }
  getIsDrawing() {
    return this.isDrawing;
  }
  getDroppedCount() {
    return this.droppedThisStroke;
  }
  reset() {
    this.currentPoints = [], this.isDrawing = !1, this.droppedThisStroke = 0, this.capWarned = !1;
  }
}, In = 4, _n = 3, Dn = 0.75, Nn = 0.25, Fn = 0.25, Bn = 0.75, Ai = class {
  name = "smooth";
  processBatch(t) {
    return On(t, In);
  }
  reset() {
  }
};
function On(t, e) {
  if (t.length < _n) return t;
  let i = t.map((s) => ({ ...s }));
  for (let s = 0; s < e; s++) i = Rn(i);
  return i;
}
function Rn(t) {
  const e = [t[0]];
  for (let i = 0; i < t.length - 1; i++) {
    const s = t[i], r = t[i + 1];
    e.push(ii(s, r, Dn, Nn)), e.push(ii(s, r, Fn, Bn));
  }
  return e.push(t[t.length - 1]), e;
}
function ii(t, e, i, s) {
  return {
    x: t.x * i + e.x * s,
    y: t.y * i + e.y * s,
    t: t.t * i + e.t * s,
    pressure: t.pressure * i + e.pressure * s
  };
}
var si = class {
  captureStage;
  realTimeStages;
  stabilizeStage;
  pressureStage;
  segmentStage;
  smoothStage;
  pressureTaper;
  eventBus;
  strokeCounter = 0;
  activeStrokeId = "";
  accumulatedCount = 0;
  droppedRealTimeCount = 0;
  constructor(t) {
    this.eventBus = t, this.captureStage = new gn(), this.segmentStage = new Pn(), this.smoothStage = new Ai(), this.pressureTaper = new Ln(), this.stabilizeStage = new yn(), this.pressureStage = new Cn(), this.realTimeStages = [this.stabilizeStage, this.pressureStage];
  }
  setInputSource(t) {
    this.stabilizeStage.setInputSource(t), this.pressureStage.setInputSource(t);
  }
  processPoint(t) {
    const e = vt.enabled, i = e ? performance.now() : 0;
    let s = this.captureStage.createStrokePoint(t);
    e && vt.emit({
      stage: "capture",
      strokeId: this.activeStrokeId,
      pointsIn: 1,
      pointsOut: 1,
      timeMs: performance.now() - i,
      ts: performance.now()
    });
    for (const n of this.realTimeStages) {
      const o = e ? performance.now() : 0, a = s;
      s = n.process(s), e && vt.emit({
        stage: n.name,
        strokeId: this.activeStrokeId,
        pointsIn: 1,
        pointsOut: 1,
        timeMs: performance.now() - o,
        meta: {
          dx: s.x - a.x,
          dy: s.y - a.y,
          pressureIn: a.pressure,
          pressureOut: s.pressure
        },
        ts: performance.now()
      });
    }
    const r = e ? performance.now() : 0;
    return this.segmentStage.process(s), e && (this.accumulatedCount += 1, vt.emit({
      stage: "segment",
      strokeId: this.activeStrokeId,
      pointsIn: 1,
      pointsOut: 1,
      timeMs: performance.now() - r,
      meta: {
        phase: "accumulate",
        total: this.accumulatedCount
      },
      ts: performance.now()
    })), s;
  }
  penDown() {
    this.strokeCounter += 1, this.activeStrokeId = `stroke-${this.strokeCounter}`, this.accumulatedCount = 0, this.droppedRealTimeCount = 0, this.segmentStage.penDown(), this.eventBus.emit("stroke:start"), vt.enabled && vt.emit({
      stage: "segment",
      strokeId: this.activeStrokeId,
      timeMs: 0,
      meta: { phase: "pen-down" },
      ts: performance.now()
    });
  }
  penUp() {
    const t = vt.enabled, e = this.activeStrokeId, i = this.accumulatedCount, s = t ? performance.now() : 0, r = this.segmentStage.penUp();
    if (!r)
      return t && vt.emit({
        stage: "segment",
        strokeId: e,
        pointsIn: i,
        pointsOut: 0,
        timeMs: performance.now() - s,
        meta: {
          phase: "pen-up",
          dropped: !0,
          reason: "min-points"
        },
        ts: performance.now()
      }), this.activeStrokeId = "", this.accumulatedCount = 0, null;
    t && vt.emit({
      stage: "segment",
      strokeId: e,
      pointsIn: i,
      pointsOut: r.length,
      timeMs: performance.now() - s,
      meta: {
        phase: "pen-up",
        dropped: !1
      },
      ts: performance.now()
    });
    const n = t ? performance.now() : 0, o = this.pressureTaper.processBatch(r);
    t && vt.emit({
      stage: "pressure",
      strokeId: e,
      pointsIn: r.length,
      pointsOut: o.length,
      timeMs: performance.now() - n,
      meta: { phase: "taper-batch" },
      ts: performance.now()
    });
    const a = t ? performance.now() : 0, c = this.smoothStage.processBatch(o);
    return t && vt.emit({
      stage: "smooth",
      strokeId: e,
      pointsIn: o.length,
      pointsOut: c.length,
      timeMs: performance.now() - a,
      meta: { phase: "chaikin-batch" },
      ts: performance.now()
    }), this.eventBus.emit("stroke:end"), this.activeStrokeId = "", this.accumulatedCount = 0, {
      raw: o,
      smoothed: c
    };
  }
  getActivePoints() {
    return this.segmentStage.getCurrentPoints();
  }
  isDrawing() {
    return this.segmentStage.getIsDrawing();
  }
  reset() {
    this.captureStage.reset();
    for (const t of this.realTimeStages) t.reset();
    this.segmentStage.reset(), this.smoothStage.reset(), this.pressureTaper.reset();
  }
}, Rt = 800, Wn = 4, ri = 15, Wt = 0.012, kt = 3, zt = 2.5, zn = class {
  particles = [];
  spawnForStroke(t) {
    const e = dt[t.effect], i = t.smoothed;
    if (i.length === 0) return;
    const s = Math.max(1, Math.floor(i.length / Rt));
    this.spawnBurst(i[0], e, ri);
    for (let r = 0; r < i.length && !(this.particles.length >= Rt); r += s)
      this.spawnAt(i[r], e);
    this.spawnBurst(i[i.length - 1], e, ri);
  }
  updateAndRender(t, e, i = !1) {
    const s = e > 0 ? e / 16 : 1;
    for (let n = this.particles.length - 1; n >= 0; n--) {
      const o = this.particles[n];
      o.x += o.vx * s, o.y += o.vy * s, o.life -= o.decay * s, o.life <= 0 && (this.particles[n] = this.particles[this.particles.length - 1], this.particles.pop());
    }
    const r = i ? 2 : 1;
    t.save();
    for (let n = 0; n < this.particles.length; n += r) {
      const o = this.particles[n];
      t.globalAlpha = o.life, t.fillStyle = o.color, t.beginPath(), t.arc(o.x, o.y, o.size * o.life, 0, Math.PI * 2), t.fill();
    }
    t.restore();
  }
  clear() {
    this.particles = [];
  }
  spawnBurst(t, e, i) {
    for (let s = 0; s < i; s++) {
      if (this.particles.length >= Rt) return;
      this.particles.push({
        x: t.x,
        y: t.y,
        vx: (Math.random() - 0.5) * zt * 2,
        vy: (Math.random() - 0.5) * zt * 2,
        life: 1,
        decay: Wt * 0.5 + Math.random() * Wt,
        size: kt * 1.5 + Math.random() * kt,
        color: e.particleColor
      });
    }
  }
  spawnAt(t, e, i) {
    const s = i?.sizeMultiplier ?? 1, r = i?.velocityMultiplier ?? 1;
    for (let n = 0; n < Wn; n++) {
      if (this.particles.length >= Rt) return;
      this.particles.push({
        x: t.x,
        y: t.y,
        vx: (Math.random() - 0.5) * zt * r,
        vy: (Math.random() - 0.5) * zt * r,
        life: 1,
        decay: Wt + Math.random() * Wt,
        size: (kt + Math.random() * kt) * s,
        color: e.particleColor
      });
    }
  }
  spawnBurstAtPosition(t, e, i, s) {
    for (let r = 0; r < s; r++) {
      if (this.particles.length >= Rt) return;
      this.particles.push({
        x: t,
        y: e,
        vx: (Math.random() - 0.5) * zt * 3,
        vy: (Math.random() - 0.5) * zt * 3,
        life: 1,
        decay: Wt * 0.4 + Math.random() * Wt,
        size: kt * 2 + Math.random() * kt,
        color: i
      });
    }
  }
  spawnSparkleAlongStroke(t, e, i = 3) {
    if (t.length !== 0)
      for (let s = 0; s < i; s++) {
        if (this.particles.length >= Rt) return;
        const r = t[Math.floor(Math.random() * t.length)], n = Math.random() < 0.3, o = n ? kt * 2.5 + Math.random() * kt * 2 : kt * 0.8 + Math.random() * kt;
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * 12,
          y: r.y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4 - 0.2,
          life: 1,
          decay: 0.035 + Math.random() * 0.025,
          size: o,
          color: n ? "#ffffff" : e
        });
      }
  }
  spawnBurstForMorph(t) {
    const e = dt[t.effect];
    if (!e) return;
    const i = t.smoothed.length > 0 ? t.smoothed : t.raw;
    for (let s = 0; s < i.length; s++) {
      const r = i[s], n = 3;
      for (let o = 0; o < n; o++) this.spawnAt(r, e, {
        sizeMultiplier: 1.5 + Math.random(),
        velocityMultiplier: 2.5 + Math.random() * 2
      });
    }
    i.length > 0 && (this.spawnBurst(i[0], e, 20), this.spawnBurst(i[i.length - 1], e, 20));
  }
}, Un = "#000000";
function Hn(t, e, i, s) {
  t.clearRect(0, 0, e, i), s === "solid" && (t.fillStyle = Un, t.fillRect(0, 0, e, i));
}
function Gn(t) {
  return `rgba(${parseInt(t.slice(1, 3), 16)},${parseInt(t.slice(3, 5), 16)},${parseInt(t.slice(5, 7), 16)},0.7)`;
}
function ae(t, e, i, s = 1, r) {
  if (e.length < 2) return;
  const n = r?.customColor != null ? Gn(r.customColor) : i.glowColor, o = r?.customWidth != null ? r.customWidth * 1.2 : i.maxWidth * 1.2;
  t.save(), t.lineCap = "round", t.lineJoin = "round", t.globalAlpha = 0.7 * Math.min(s, 2), t.strokeStyle = n, t.shadowColor = n, t.shadowBlur = i.glowSize * s, t.lineWidth = o, t.beginPath(), t.moveTo(e[0].x, e[0].y);
  for (let a = 1; a < e.length; a++) t.lineTo(e[a].x, e[a].y);
  t.stroke(), t.restore();
}
function le(t, e, i, s) {
  t.save(), t.lineCap = "round", t.lineJoin = "round", t.shadowColor = "transparent", t.shadowBlur = 0, t.globalAlpha = 1;
  for (let r = 1; r < e.length; r++) {
    const n = e[r - 1], o = e[r], a = s?.customWidth != null ? s.customWidth : jn(o.pressure, i), c = s?.customColor != null ? s.customColor : Xn(r, e.length, i);
    t.beginPath(), t.moveTo(n.x, n.y), t.lineTo(o.x, o.y), t.strokeStyle = c, t.lineWidth = a, t.stroke();
  }
  t.restore();
}
function jn(t, e) {
  return e.minWidth + t * (e.maxWidth - e.minWidth);
}
function Xn(t, e, i) {
  if (!i.gradient) return i.color;
  const s = e > 1 ? t / (e - 1) : 0;
  return Mi(i.gradient, s);
}
function ni(t) {
  if (!(t.customColor == null && t.customWidth == null))
    return {
      customColor: t.customColor,
      customWidth: t.customWidth
    };
}
function Vn(t, e, i, s, r, n, o) {
  const a = performance.now(), c = n != null && n.hasAnimations(), l = /* @__PURE__ */ new Map();
  if (c) for (const u of e) {
    const p = n.getTransform(u.id, a);
    p && l.set(u.id, p);
  }
  const h = l.size > 0, d = h ? e.filter((u) => !l.has(u.id)) : e;
  if ((r || h) && s && i) {
    s.clearRect(0, 0, i.width, i.height);
    for (const u of d) {
      if (u.smoothed.length < 2) continue;
      const p = dt[u.effect], f = ni(u);
      ae(s, u.smoothed, p, 1, f), le(s, u.smoothed, p, f);
    }
  }
  if (d.length > 0 && i && t.drawImage(i, 0, 0), h) for (const u of e) {
    const p = l.get(u.id);
    if (!p || u.smoothed.length < 2) continue;
    const f = dt[u.effect], m = ni(u);
    let y, S;
    const M = o?.getObjectByStrokeId(u.id);
    if (M)
      y = M.bbox.x + M.bbox.width / 2, S = M.bbox.y + M.bbox.height / 2;
    else {
      const w = ee(u.smoothed);
      y = w.x + w.width / 2, S = w.y + w.height / 2;
    }
    t.save(), t.globalAlpha = p.opacity, t.translate(y + p.translateX, S + p.translateY), t.rotate(p.rotation), t.scale(p.scale, p.scale), t.translate(-y, -S), ae(t, u.smoothed, f, p.glowIntensity, m), le(t, u.smoothed, f, m), t.restore();
  }
  return h;
}
function $n(t, e) {
  const { effect: i, points: s, progress: r } = e;
  if (s.length < 2) return;
  const n = 1 + Math.sin(r * Math.PI) * 1, o = dt[i];
  ae(t, s, o, n), le(t, s, o);
}
function qn(t, e) {
  const i = e.points;
  if (i.length === 0) return;
  t.save(), t.lineCap = "round", t.lineJoin = "round";
  const s = i[0], r = i.reduce((o, a) => o + a.alpha, 0) / i.length, n = `rgba(${s.color.r},${s.color.g},${s.color.b},${r * 0.6})`;
  t.globalAlpha = r * 0.7, t.strokeStyle = n, t.shadowColor = n, t.shadowBlur = 20, t.lineWidth = 4, t.beginPath(), t.moveTo(s.x, s.y);
  for (let o = 1; o < i.length; o++) {
    const a = i[o - 1], c = i[o], l = c.x - a.x, h = c.y - a.y;
    l * l + h * h > 400 ? t.moveTo(c.x, c.y) : t.lineTo(c.x, c.y);
  }
  t.stroke(), t.shadowBlur = 0, t.shadowColor = "transparent", t.globalAlpha = 1;
  for (let o = 1; o < i.length; o++) {
    const a = i[o - 1], c = i[o], l = c.x - a.x, h = c.y - a.y;
    l * l + h * h > 400 || (t.beginPath(), t.moveTo(a.x, a.y), t.lineTo(c.x, c.y), t.strokeStyle = `rgba(${c.color.r},${c.color.g},${c.color.b},${c.alpha})`, t.lineWidth = c.size * 1.5, t.stroke());
  }
  t.restore();
}
function Yn(t, e, i) {
  return e.filter(({ stroke: s, fadeStart: r, fadeDuration: n }) => {
    const o = i - r;
    if (o >= n) return !1;
    const a = 1 - o / n, c = dt[s.effect], l = s.customColor != null || s.customWidth != null ? {
      customColor: s.customColor,
      customWidth: s.customWidth
    } : void 0;
    return t.save(), t.globalAlpha = a, ae(t, s.smoothed, c, 1, l), le(t, s.smoothed, c, l), t.restore(), !0;
  });
}
function Zn(t, e, i) {
  if (e.length !== 0)
    for (const s of e) {
      const r = i - s.startTime, n = Math.min(1, r / s.fadeDuration);
      t.save(), t.globalAlpha = n, t.font = s.font, t.textBaseline = "top", t.textAlign = "left";
      const o = t.measureText(s.text), a = o.width, c = o.actualBoundingBoxDescent ?? 72, l = s.width / Math.max(a, 1), h = s.height / Math.max(c, 1), d = Math.min(l, h, 3), u = s.x + s.width / 2, p = s.y + s.height / 2;
      t.translate(u, p), t.scale(d, d), t.translate(-a / 2, -c / 2);
      const f = 0.5 + n * 0.5;
      t.shadowColor = s.glowColor, t.shadowBlur = s.glowSize * f, t.fillStyle = s.effectColor, t.fillText(s.text, 0, 0), t.shadowBlur = 0, t.fillText(s.text, 0, 0), t.restore();
    }
}
function Kn(t, e, i) {
  if (e.length !== 0) {
    if (e.length === 1) {
      const s = e[0];
      t.save(), t.beginPath(), t.arc(s.x, s.y, i.minWidth / 2, 0, Math.PI * 2), t.fillStyle = i.color, t.shadowColor = i.glowColor, t.shadowBlur = i.glowSize * 0.3, t.fill(), t.restore();
      return;
    }
    t.save(), t.lineCap = "round", t.lineJoin = "round", t.shadowColor = i.glowColor, t.shadowBlur = i.glowSize * 0.6, t.globalAlpha = 0.7, t.strokeStyle = i.glowColor, t.lineWidth = i.maxWidth, t.beginPath(), t.moveTo(e[0].x, e[0].y);
    for (let s = 1; s < e.length; s++) t.lineTo(e[s].x, e[s].y);
    t.stroke(), t.shadowBlur = 0, t.globalAlpha = 1, t.strokeStyle = i.color, t.lineWidth = i.minWidth, t.beginPath(), t.moveTo(e[0].x, e[0].y);
    for (let s = 1; s < e.length; s++) t.lineTo(e[s].x, e[s].y);
    t.stroke(), t.restore();
  }
}
function Jn(t, e, i, s) {
  const r = performance.now();
  for (const n of e) {
    if (i && s) {
      const o = i.getObjectByFillId(n.id);
      if (o && o.strokeIds.length > 0) {
        const a = s.getTransform(o.strokeIds[0], r);
        if (a) {
          const c = o.bbox.x + o.bbox.width / 2, l = o.bbox.y + o.bbox.height / 2;
          t.save(), t.globalAlpha = a.opacity, t.translate(c + a.translateX, l + a.translateY), t.rotate(a.rotation), t.scale(a.scale, a.scale), t.translate(-c, -l), t.drawImage(n.bitmap, 0, 0), t.restore();
          continue;
        }
      }
    }
    t.drawImage(n.bitmap, 0, 0);
  }
}
var te = 8, Qn = 5, Ee = [8, 4], to = 0.05, eo = Ee[0] + Ee[1];
function io(t, e, i, s, r, n) {
  if (e.size === 0) return;
  t.save();
  const o = Ae(s, 0.7), a = Ae(s, 0.9), c = Ae(s, 0.3), l = -(r * to) % eo, h = Ee.map((d) => d * n);
  for (const d of e) {
    const u = i.getObject(d);
    if (!u) continue;
    const p = u.bbox.x - te * n, f = u.bbox.y - te * n, m = u.bbox.width + te * 2 * n, y = u.bbox.height + te * 2 * n;
    t.shadowBlur = 6 * n, t.shadowColor = c, t.strokeStyle = o, t.lineWidth = 2 * n, t.setLineDash(h), t.lineDashOffset = l * n, t.strokeRect(p, f, m, y), t.shadowBlur = 0, t.shadowColor = "transparent", t.fillStyle = a;
    const S = Qn * n, M = [
      [p, f],
      [p + m, f],
      [p, f + y],
      [p + m, f + y]
    ];
    for (const [w, _] of M)
      t.beginPath(), t.arc(w, _, S, 0, Math.PI * 2), t.fill();
  }
  t.setLineDash([]), t.restore();
}
function Ae(t, e) {
  if (t.startsWith("#")) {
    let i = t.slice(1);
    if (i.length === 3 && (i = i[0] + i[0] + i[1] + i[1] + i[2] + i[2]), i.length >= 6) return `rgba(${parseInt(i.slice(0, 2), 16)},${parseInt(i.slice(2, 4), 16)},${parseInt(i.slice(4, 6), 16)},${e})`;
  }
  if (t.startsWith("rgb")) {
    const i = t.match(/[\d.]+/g);
    if (i && i.length >= 3) return `rgba(${i[0]},${i[1]},${i[2]},${e})`;
  }
  return t;
}
var Gt = class bi {
  type = "canvas2d";
  ctx;
  canvas;
  dpr;
  particleSystem = new zn();
  perfMonitor = new Ri();
  eventBus = null;
  animationId = null;
  lastFrameTime = 0;
  degradedEmitted = !1;
  completedStrokes = [];
  activePoints = [];
  activeEffect = "neon";
  overlayTexts = [];
  fadingStrokes = [];
  morphAnimator = null;
  fontMorphAnimator = null;
  backgroundMode = "solid";
  morphBurstFired = !1;
  lastSparkleSpawn = 0;
  static SPARKLE_INTERVAL = 120;
  completedCache = null;
  completedCacheCtx = null;
  completedCacheDirty = !0;
  fills = [];
  strokeAnimator = null;
  objectStore = null;
  selectionManager = null;
  getActivePointsFn = null;
  constructor(e, i = typeof window < "u" && window.devicePixelRatio || 1) {
    this.canvas = e, this.dpr = i;
    const s = e.getContext("2d");
    if (!s) throw new Error("Failed to get 2D context");
    this.ctx = s, this.setupCanvas();
  }
  setEventBus(e) {
    this.eventBus = e;
  }
  start() {
    this.animationId === null && (typeof requestAnimationFrame > "u" || (this.lastFrameTime = performance.now(), this.animationId = requestAnimationFrame((e) => this.renderLoop(e))));
  }
  stop() {
    this.animationId !== null && typeof cancelAnimationFrame < "u" && (cancelAnimationFrame(this.animationId), this.animationId = null);
  }
  setActivePointsSource(e) {
    this.getActivePointsFn = e;
  }
  setMorphAnimator(e) {
    e !== null && this.morphAnimator === null && (this.morphBurstFired = !1), this.morphAnimator = e;
  }
  setFontMorphAnimator(e) {
    console.info("[stroke-trace] renderer:setFontMorphAnimator", {
      animator: e ? "attach" : "detach",
      completedStrokesLen: this.completedStrokes.length,
      cacheDirty: this.completedCacheDirty,
      ts: performance.now()
    }), this.fontMorphAnimator = e;
  }
  setStrokeAnimator(e) {
    this.strokeAnimator = e;
  }
  setObjectStore(e) {
    this.objectStore = e;
  }
  setSelectionManager(e) {
    this.selectionManager = e;
  }
  markDirty() {
    this.completedCacheDirty = !0;
  }
  setBackgroundMode(e) {
    this.backgroundMode = e;
  }
  addCompletedStroke(e) {
    this.completedStrokes.push(e), this.particleSystem.spawnForStroke(e), this.completedCacheDirty = !0;
  }
  removeLastStroke() {
    const e = this.completedStrokes.pop();
    return this.completedCacheDirty = !0, e;
  }
  removeStrokeById(e) {
    const i = this.completedStrokes.findIndex((r) => r.id === e);
    if (i === -1) return;
    const [s] = this.completedStrokes.splice(i, 1);
    return this.completedCacheDirty = !0, s;
  }
  fadeOutLastStroke(e) {
    const i = this.completedStrokes.pop();
    return i && (this.fadingStrokes.push({
      stroke: i,
      fadeStart: performance.now(),
      fadeDuration: e
    }), this.completedCacheDirty = !0), i;
  }
  fadeOutStrokeById(e, i) {
    const s = this.completedStrokes.findIndex((n) => n.id === e);
    if (s === -1) return;
    const [r] = this.completedStrokes.splice(s, 1);
    return this.fadingStrokes.push({
      stroke: r,
      fadeStart: performance.now(),
      fadeDuration: i
    }), this.completedCacheDirty = !0, r;
  }
  clearAll() {
    this.completedStrokes = [], this.overlayTexts = [], this.fadingStrokes = [], this.clearFills(), this.particleSystem.clear(), this.completedCacheDirty = !0;
  }
  setOverlayText(e) {
    if (e) {
      this.overlayTexts.push(e);
      for (const r of this.completedStrokes) this.fadingStrokes.push({
        stroke: r,
        fadeStart: performance.now(),
        fadeDuration: e.fadeDuration
      });
      this.completedStrokes = [], this.completedCacheDirty = !0;
      const i = e.x + e.width / 2, s = e.y + e.height / 2;
      this.particleSystem.spawnBurstAtPosition(i, s, e.glowColor, 40);
    }
  }
  clearOverlayText() {
    this.overlayTexts = [], this.fadingStrokes = [];
  }
  setEffect(e) {
    this.activeEffect = e;
  }
  getEffect() {
    return this.activeEffect;
  }
  getStrokeCount() {
    return this.completedStrokes.length;
  }
  addFill(e) {
    this.fills.push(e);
  }
  removeLastFill() {
    return this.fills.pop();
  }
  removeFillById(e) {
    const i = this.fills.findIndex((r) => r.id === e);
    if (i === -1) return;
    const [s] = this.fills.splice(i, 1);
    return s;
  }
  clearFills() {
    this.fills = [];
  }
  getFillCount() {
    return this.fills.length;
  }
  destroy() {
    this.stop(), this.clearAll();
  }
  setupCanvas() {
    const { width: e, height: i } = this.canvas.getBoundingClientRect();
    this.canvas.width = e * this.dpr, this.canvas.height = i * this.dpr, this.completedCache = new OffscreenCanvas(this.canvas.width, this.canvas.height), this.completedCacheCtx = this.completedCache.getContext("2d"), this.completedCacheDirty = !0;
  }
  renderLoop(e) {
    this.perfMonitor.startFrame();
    const i = e - this.lastFrameTime;
    this.lastFrameTime = e;
    const s = this.perfMonitor.isPerformanceDegraded();
    this.activePoints = this.getActivePointsFn?.() ?? [], Hn(this.ctx, this.canvas.width, this.canvas.height, this.backgroundMode), Jn(this.ctx, this.fills, this.objectStore, this.strokeAnimator), this.completedCacheDirty = Vn(this.ctx, this.completedStrokes, this.completedCache, this.completedCacheCtx, this.completedCacheDirty, this.strokeAnimator, this.objectStore), this.selectionManager && this.selectionManager.count > 0 && this.objectStore && io(this.ctx, this.selectionManager.getSelectedIds(), this.objectStore, dt[this.activeEffect].color, e, this.dpr), this.renderMorphLayer(i), this.renderTextMorphLayer(), this.fadingStrokes = Yn(this.ctx, this.fadingStrokes, performance.now()), Zn(this.ctx, this.overlayTexts, performance.now()), Kn(this.ctx, this.activePoints, dt[this.activeEffect]), this.spawnSparkleParticles(e), this.particleSystem.updateAndRender(this.ctx, i, s), this.perfMonitor.endFrame(), this.emitDegradedIfNeeded(s), typeof requestAnimationFrame < "u" && (this.animationId = requestAnimationFrame((r) => this.renderLoop(r)));
  }
  renderMorphLayer(e) {
    const i = this.morphAnimator;
    if (!i?.isActive()) return;
    if (!this.morphBurstFired) {
      this.morphBurstFired = !0;
      const r = i.sourceStroke;
      r && this.particleSystem.spawnBurstForMorph(r);
    }
    const s = i.update(e);
    !s || s.length < 2 || $n(this.ctx, {
      effect: i.effect,
      points: s,
      progress: i.getProgress()
    });
  }
  renderTextMorphLayer() {
    const e = this.fontMorphAnimator;
    if (!e) return;
    const i = e.getLastFrame();
    !i || i.points.length === 0 || qn(this.ctx, i);
  }
  spawnSparkleParticles(e) {
    if (!this.strokeAnimator?.hasAnimations() || e - this.lastSparkleSpawn < bi.SPARKLE_INTERVAL) return;
    this.lastSparkleSpawn = e;
    const i = this.strokeAnimator.getSparkleStrokeIds(e);
    for (const s of i) {
      const r = this.completedStrokes.find((o) => o.id === s);
      if (!r || r.smoothed.length < 2) continue;
      const n = dt[r.effect];
      this.particleSystem.spawnSparkleAlongStroke(r.smoothed, n.particleColor);
    }
  }
  emitDegradedIfNeeded(e) {
    e && !this.degradedEmitted ? (this.degradedEmitted = !0, this.eventBus?.emit("performance:degraded")) : !e && this.degradedEmitted && (this.degradedEmitted = !1);
  }
}, so = 2e3, ro = {
  r: 0,
  g: 0,
  b: 0,
  a: 1
}, oi = "#10b981", no = 3;
function oo() {
  return typeof navigator < "u" && "gpu" in navigator;
}
async function ao() {
  if (!oo()) return null;
  try {
    return await Promise.race([(async () => {
      const t = await navigator.gpu.requestAdapter();
      return t ? { device: await t.requestDevice() } : null;
    })(), new Promise((t) => setTimeout(() => t(null), so))]) ?? null;
  } catch {
    return null;
  }
}
var lo = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  effect_id: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
};
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) world_pos: vec2<f32>,
};

@vertex fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  var pos = input.position;

  // Liquid: sin/cos wave displacement
  if (u.effect_id > 0.5 && u.effect_id < 1.5) {
    let freq = 0.015;
    let amp = 6.0;
    pos.x = pos.x + sin(pos.y * freq + u.time * 2.0) * amp;
    pos.y = pos.y + cos(pos.x * freq + u.time * 1.5) * amp * 0.7;
  }

  let ndc = (pos / u.resolution) * 2.0 - 1.0;
  out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
  out.color = input.color;
  out.world_pos = pos;
  return out;
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var col = input.color;

  // Hologram: RGB channel shift + scanlines
  if (u.effect_id > 1.5 && u.effect_id < 2.5) {
    let scanline = step(0.5, fract(input.world_pos.y / 4.0));
    col = col * (0.8 + 0.2 * scanline);
    let glitch = step(0.93, fract(u.time * 0.3)) * sin(input.world_pos.y * 50.0 + u.time * 80.0) * 0.15;
    col.r = col.r + glitch;
    col.b = col.b - glitch;
  }

  // Bloom: bright additive glow
  if (u.effect_id > 2.5 && u.effect_id < 3.5) {
    let brightness = dot(col.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let bloom = smoothstep(0.3, 0.8, brightness) * 0.5;
    col = vec4<f32>(col.rgb + vec3<f32>(bloom), col.a);
  }

  // GPU Particles: pulsing size/alpha
  if (u.effect_id > 3.5 && u.effect_id < 4.5) {
    let pulse = 0.8 + 0.2 * sin(u.time * 3.0 + input.world_pos.x * 0.05);
    col = vec4<f32>(col.rgb * pulse, col.a * pulse);
  }

  // Dissolve: noise-based alpha cutoff
  if (u.effect_id > 4.5 && u.effect_id < 5.5) {
    let n = fract(sin(dot(input.world_pos * 0.01, vec2<f32>(12.9898, 78.233))) * 43758.5453);
    let progress = fract(u.time * 0.15);
    let cycle = abs(progress * 2.0 - 1.0);
    let edge = smoothstep(cycle - 0.08, cycle, n);
    let edge_glow = smoothstep(cycle - 0.08, cycle, n) - smoothstep(cycle, cycle + 0.04, n);
    col = vec4<f32>(col.rgb + vec3<f32>(1.0, 0.6, 0.2) * edge_glow * 2.0, col.a * edge);
  }

  return col;
}
`, co = `
struct Uniforms { resolution: vec2<f32>, time: f32, _pad: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput { @location(0) position: vec2<f32>, @location(1) color: vec4<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) color: vec4<f32> };

@vertex fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let ndc = (input.position / u.resolution) * 2.0 - 1.0;
  out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color.rgb, input.color.a * 0.35);
}
`, ho = {
  liquid: 1,
  hologram: 2,
  bloom: 3,
  "gpu-particles": 4,
  dissolve: 5
}, uo = class {
  type = "webgpu";
  canvas;
  dpr;
  device = null;
  gpuContext = null;
  format = "bgra8unorm";
  strokePipeline = null;
  glowPipeline = null;
  uniformBuffer = null;
  uniformBindGroup = null;
  animationId = null;
  lastFrameTime = 0;
  elapsedTime = 0;
  completedStrokes = [];
  activePoints = [];
  activeEffect = "liquid";
  morphAnimator = null;
  getActivePointsFn = null;
  overlayCanvas = null;
  overlayCtx = null;
  initialized = !1;
  constructor(t, e = 1) {
    this.canvas = t, this.dpr = e;
  }
  async init() {
    if (this.initialized) return !0;
    const t = await ao();
    if (!t) return !1;
    this.device = t.device;
    const e = this.canvas.getContext("webgpu");
    return e ? (this.gpuContext = e, this.format = navigator.gpu.getPreferredCanvasFormat(), e.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied"
    }), this.setupOverlay(), this.createPipelines(), this.initialized = !0, !0) : (this.device.destroy(), this.device = null, !1);
  }
  setEventBus(t) {
  }
  start() {
    this.animationId === null && (this.lastFrameTime = performance.now(), this.animationId = requestAnimationFrame((t) => this.renderLoop(t)));
  }
  stop() {
    this.animationId !== null && (cancelAnimationFrame(this.animationId), this.animationId = null);
  }
  setActivePointsSource(t) {
    this.getActivePointsFn = t;
  }
  setMorphAnimator(t) {
    this.morphAnimator = t;
  }
  setFontMorphAnimator(t) {
  }
  setOverlayText(t) {
  }
  clearOverlayText() {
  }
  markDirty() {
  }
  addFill(t) {
  }
  removeLastFill() {
  }
  removeFillById(t) {
  }
  clearFills() {
  }
  getFillCount() {
    return 0;
  }
  addCompletedStroke(t) {
    this.completedStrokes.push(t);
  }
  removeLastStroke() {
    return this.completedStrokes.pop();
  }
  removeStrokeById(t) {
    const e = this.completedStrokes.findIndex((i) => i.id === t);
    if (e !== -1)
      return this.completedStrokes.splice(e, 1)[0];
  }
  fadeOutLastStroke(t) {
    return this.completedStrokes.pop();
  }
  fadeOutStrokeById(t, e) {
    const i = this.completedStrokes.findIndex((s) => s.id === t);
    if (i !== -1)
      return this.completedStrokes.splice(i, 1)[0];
  }
  clearAll() {
    this.completedStrokes = [];
  }
  setEffect(t) {
    this.activeEffect = t;
  }
  getEffect() {
    return this.activeEffect;
  }
  getStrokeCount() {
    return this.completedStrokes.length;
  }
  setBackgroundMode(t) {
  }
  destroy() {
    this.stop(), this.completedStrokes = [], this.uniformBuffer?.destroy(), this.device?.destroy(), this.device = null, this.gpuContext = null, this.initialized = !1, this.removeOverlay();
  }
  isGPUEffect(t) {
    return be.includes(t);
  }
  createPipelines() {
    const t = this.device, e = {
      arrayStride: 24,
      attributes: [{
        shaderLocation: 0,
        offset: 0,
        format: "float32x2"
      }, {
        shaderLocation: 1,
        offset: 8,
        format: "float32x4"
      }]
    };
    this.uniformBuffer = t.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const i = t.createBindGroupLayout({ entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" }
    }] });
    this.uniformBindGroup = t.createBindGroup({
      layout: i,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    });
    const s = t.createPipelineLayout({ bindGroupLayouts: [i] }), r = t.createShaderModule({ code: lo });
    this.strokePipeline = t.createRenderPipeline({
      layout: s,
      vertex: {
        module: r,
        entryPoint: "vs_main",
        buffers: [e]
      },
      fragment: {
        module: r,
        entryPoint: "fs_main",
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }]
      },
      primitive: { topology: "triangle-list" }
    });
    const n = t.createShaderModule({ code: co });
    this.glowPipeline = t.createRenderPipeline({
      layout: s,
      vertex: {
        module: n,
        entryPoint: "vs_main",
        buffers: [e]
      },
      fragment: {
        module: n,
        entryPoint: "fs_main",
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one",
              operation: "add"
            }
          }
        }]
      },
      primitive: { topology: "triangle-list" }
    });
  }
  renderLoop(t) {
    const e = t - this.lastFrameTime;
    this.lastFrameTime = t, this.elapsedTime += e * 1e-3, this.activePoints = this.getActivePointsFn?.() ?? [], this.device && this.gpuContext && this.renderFrame(e), this.renderOverlay(), this.animationId = requestAnimationFrame((i) => this.renderLoop(i));
  }
  renderFrame(t) {
    const e = this.device, i = this.gpuContext;
    let s;
    try {
      s = i.getCurrentTexture();
    } catch {
      return;
    }
    const r = this.canvas.width || this.canvas.clientWidth * this.dpr, n = this.canvas.height || this.canvas.clientHeight * this.dpr, o = ho[this.activeEffect] ?? 0;
    e.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      r,
      n,
      this.elapsedTime,
      o
    ]));
    const a = e.createCommandEncoder(), c = a.beginRenderPass({ colorAttachments: [{
      view: s.createView(),
      clearValue: ro,
      loadOp: "clear",
      storeOp: "store"
    }] });
    for (const h of this.completedStrokes) {
      if (h.smoothed.length < 2) continue;
      const d = dt[h.effect];
      this.drawStroke(c, e, h.smoothed, d, !0), this.drawStroke(c, e, h.smoothed, d, !1);
    }
    const l = this.morphAnimator;
    if (l?.isActive()) {
      const h = l.effect, d = l.update(t);
      if (d && d.length >= 2) {
        const u = dt[h];
        this.drawStroke(c, e, d, u, !0), this.drawStroke(c, e, d, u, !1);
      }
    }
    c.end(), e.queue.submit([a.finish()]);
  }
  drawStroke(t, e, i, s, r) {
    const n = this.buildStrokeGeometry(i, s, r);
    if (n.length === 0) return;
    const o = e.createBuffer({
      size: n.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    e.queue.writeBuffer(o, 0, n);
    const a = r ? this.glowPipeline : this.strokePipeline;
    t.setPipeline(a), t.setBindGroup(0, this.uniformBindGroup), t.setVertexBuffer(0, o), t.draw(n.length / 6), o.destroy();
  }
  buildStrokeGeometry(t, e, i) {
    const s = t.length - 1;
    if (s <= 0) return new Float32Array(0);
    const r = new Float32Array(s * 6 * 6);
    let n = 0;
    for (let o = 0; o < s; o++) {
      const a = t[o], c = t[o + 1], l = c.x - a.x, h = c.y - a.y, d = Math.sqrt(l * l + h * h) || 1, u = -h / d, p = l / d, f = (e.minWidth + a.pressure * (e.maxWidth - e.minWidth)) * (i ? 3 : 1), m = (e.minWidth + c.pressure * (e.maxWidth - e.minWidth)) * (i ? 3 : 1), y = s > 1 ? o / s : 0;
      let S, M, w, _;
      if (i) {
        const $ = fo(e.glowColor);
        S = $.r, M = $.g, w = $.b, _ = $.a;
      } else if (e.gradient && e.gradient.length >= 2) {
        const $ = po(e.gradient, y);
        S = $.r, M = $.g, w = $.b, _ = 1;
      } else {
        const $ = se(e.color);
        S = $.r / 255, M = $.g / 255, w = $.b / 255, _ = 1;
      }
      const N = a.x + u * f * 0.5, z = a.y + p * f * 0.5, C = a.x - u * f * 0.5, I = a.y - p * f * 0.5, H = c.x + u * m * 0.5, B = c.y + p * m * 0.5, O = c.x - u * m * 0.5, Y = c.y - p * m * 0.5;
      r[n++] = N, r[n++] = z, r[n++] = S, r[n++] = M, r[n++] = w, r[n++] = _, r[n++] = C, r[n++] = I, r[n++] = S, r[n++] = M, r[n++] = w, r[n++] = _, r[n++] = H, r[n++] = B, r[n++] = S, r[n++] = M, r[n++] = w, r[n++] = _, r[n++] = H, r[n++] = B, r[n++] = S, r[n++] = M, r[n++] = w, r[n++] = _, r[n++] = C, r[n++] = I, r[n++] = S, r[n++] = M, r[n++] = w, r[n++] = _, r[n++] = O, r[n++] = Y, r[n++] = S, r[n++] = M, r[n++] = w, r[n++] = _;
    }
    return r;
  }
  setupOverlay() {
    this.overlayCanvas = document.createElement("canvas");
    const t = this.canvas.clientWidth * this.dpr, e = this.canvas.clientHeight * this.dpr;
    this.overlayCanvas.width = t, this.overlayCanvas.height = e, this.overlayCanvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;", this.canvas.parentElement?.appendChild(this.overlayCanvas), this.overlayCtx = this.overlayCanvas.getContext("2d");
  }
  removeOverlay() {
    this.overlayCanvas?.remove(), this.overlayCanvas = null, this.overlayCtx = null;
  }
  renderOverlay() {
    const t = this.overlayCtx;
    if (!(!t || !this.overlayCanvas) && (t.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height), this.activePoints.length !== 0)) {
      t.save(), t.fillStyle = oi, t.shadowColor = oi, t.shadowBlur = 8;
      for (const e of this.activePoints)
        t.beginPath(), t.arc(e.x, e.y, no, 0, Math.PI * 2), t.fill();
      t.restore();
    }
  }
};
function fo(t) {
  const e = t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (e) return {
    r: +e[1] / 255,
    g: +e[2] / 255,
    b: +e[3] / 255,
    a: e[4] !== void 0 ? +e[4] : 1
  };
  const i = se(t);
  return {
    r: i.r / 255,
    g: i.g / 255,
    b: i.b / 255,
    a: 1
  };
}
function po(t, e) {
  const i = t.length - 1, s = Math.min(Math.floor(e * i), i - 1), r = e * i - s, n = se(t[s]), o = se(t[s + 1]);
  return {
    r: (n.r + (o.r - n.r) * r) / 255,
    g: (n.g + (o.g - n.g) * r) / 255,
    b: (n.b + (o.b - n.b) * r) / 255
  };
}
var mo = class {
  listeners = /* @__PURE__ */ new Map();
  on(t, e) {
    return this.listeners.has(t) || this.listeners.set(t, /* @__PURE__ */ new Set()), this.listeners.get(t).add(e), () => this.off(t, e);
  }
  once(t, e) {
    const i = (...s) => {
      this.off(t, i), e(...s);
    };
    return this.on(t, i);
  }
  off(t, e) {
    this.listeners.get(t)?.delete(e);
  }
  emit(t, ...e) {
    const i = this.listeners.get(t);
    if (i)
      for (const s of i) s(...e);
  }
  clear() {
    this.listeners.clear();
  }
}, go = {
  eng: "en",
  kor: "ko",
  jpn: "ja",
  zho: "zh",
  chi_sim: "zh-Hans",
  chi_tra: "zh-Hant",
  fra: "fr",
  deu: "de",
  spa: "es",
  por: "pt",
  rus: "ru",
  ara: "ar"
}, yo = class {
  textRecognizer = null;
  glyphExtractor = null;
  pointMatcher = null;
  morphAnimator = null;
  destroyed = !1;
  typographyMode = "overlay";
  presetText = null;
  constructor(t, e, i, s = "neon") {
    this.config = t, this.eventBus = e, this.stateMachine = i, this.effect = s;
  }
  setTypographyMode(t) {
    this.typographyMode = t;
  }
  getTypographyMode() {
    return this.typographyMode;
  }
  get enabled() {
    return this.config.enabled;
  }
  setEnabled(t) {
    this.config.enabled = t, t && !this.textRecognizer && this.initModules();
  }
  setFont(t) {
    this.config.font = t, this.textRecognizer?.updateConfig({ font: t }), this.glyphExtractor?.updateConfig({ font: t });
  }
  getFont() {
    return this.config.font;
  }
  setEffect(t) {
    this.effect = t;
  }
  setPresetText(t) {
    this.presetText = t || null;
  }
  getPresetText() {
    return this.presetText;
  }
  getMorphAnimator() {
    return this.morphAnimator;
  }
  async runPipeline(t) {
    if (!(this.typographyMode !== "overlay" && (!this.glyphExtractor || !this.pointMatcher))) {
      this.stateMachine.transition("recognize_start");
      try {
        let e;
        if (this.presetText) e = this.presetText;
        else {
          const r = this.config.language?.split("+")[0] ?? "eng", n = await li(t, go[r] ?? r.slice(0, 2));
          if (!n) {
            this.eventBus.emit("text:error", {
              code: "RECOGNITION_FAILED",
              message: "Handwriting recognition failed — try writing more clearly"
            }), this.stateMachine.transition("recognize_fail");
            return;
          }
          e = n.text;
        }
        if (this.eventBus.emit("text:recognized", {
          text: e,
          confidence: 1,
          characters: [],
          processingTimeMs: 0
        }), this.typographyMode === "overlay") {
          const r = So(t), n = dt[this.effect], o = {
            text: e.trim(),
            font: this.config.font,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            effectColor: n?.color ?? "#00ffaa",
            glowColor: n?.glowColor ?? "rgba(0,255,170,0.7)",
            glowSize: n?.glowSize ?? 40,
            startTime: performance.now(),
            fadeDuration: 600
          };
          this.eventBus.emit("text:overlay", o), this.stateMachine.transition("recognize_complete");
          return;
        }
        if (!this.glyphExtractor || !this.pointMatcher) return;
        const i = await this.glyphExtractor.extractAll(e);
        this.eventBus.emit("glyph:extracted", i), this.stateMachine.transition("recognize_complete");
        const s = this.pointMatcher.matchAll(t, i);
        this.eventBus.emit("text:matched", s), await this.startMorph(s);
      } catch (e) {
        const i = e instanceof Error ? e.message : "OCR_FAILED";
        this.eventBus.emit("text:error", {
          code: i,
          message: `Text recognition failed: ${i}`
        }), this.stateMachine.transition("recognize_fail");
      }
    }
  }
  dispose() {
    this.destroyed = !0, this.morphAnimator?.cancel(), this.morphAnimator = null, this.textRecognizer?.dispose().catch(() => {
    }), this.textRecognizer = null, this.glyphExtractor = null, this.pointMatcher = null;
  }
  async startMorph(t) {
    this.morphAnimator?.cancel();
    const e = dt[this.effect].color, { FontMorphAnimator: i } = await import("./FontMorphAnimator-vP_luMG2.js");
    this.destroyed || (this.morphAnimator = new i({
      matchedCharacters: t,
      effectColor: e
    }, this.eventBus), this.morphAnimator.start());
  }
  initModules() {
    Promise.all([
      import("./TextRecognizer-Bt5dk2zy.js"),
      import("./GlyphExtractor-DOTe8b6o.js"),
      import("./PointMatcher-DK4by-C2.js")
    ]).then(([t, e, i]) => {
      this.destroyed || (this.textRecognizer = new t.TextRecognizer(this.config), this.glyphExtractor = new e.GlyphExtractor(this.config), this.pointMatcher = new i.PointMatcher());
    }).catch(() => {
      this.config.enabled = !1, this.eventBus.emit("text:error", {
        code: "TESSERACT_LOAD_FAILED",
        message: "Failed to load text mode modules"
      });
    });
  }
};
function So(t) {
  let e = 1 / 0, i = 1 / 0, s = -1 / 0, r = -1 / 0;
  for (const n of t) for (const o of n)
    o.x < e && (e = o.x), o.y < i && (i = o.y), o.x > s && (s = o.x), o.y > r && (r = o.y);
  return isFinite(e) ? {
    x: e,
    y: i,
    width: s - e,
    height: r - i
  } : {
    x: 0,
    y: 0,
    width: 100,
    height: 100
  };
}
var vo = "neon", wo = 50, ai = 300, jo = class ki {
  canvas;
  options;
  eventBus;
  inputManager;
  pipeline;
  renderer;
  stateMachine;
  webgpuAvailable = !1;
  strokes = [];
  fills = [];
  currentEffect;
  morphAnimator = null;
  strokeAnimator;
  objectStore;
  pendingStroke = null;
  destroyed = !1;
  instantComplete = !1;
  _customColor = null;
  _customWidth = null;
  _pendingCustomColor = null;
  _pendingCustomWidth = null;
  _pausedAnimations = /* @__PURE__ */ new Map();
  _pausedObjectAnimations = /* @__PURE__ */ new Map();
  pipeline2;
  secondHandPenIsDown = !1;
  gestureEngine;
  overlayTimer = null;
  selectionManager;
  strokeCorrector = new rn();
  smoothStageRef = new Ai();
  autoCorrectEnabled = !1;
  textPipeline;
  accumulatedStrokes = [];
  kineticEngine;
  constructor(e, i) {
    this.canvas = e, this.currentEffect = i?.effect ?? vo, this.options = {
      effect: this.currentEffect,
      maxStrokes: i?.maxStrokes ?? wo,
      pixelRatio: i?.pixelRatio ?? (typeof window < "u" && window.devicePixelRatio || 1)
    }, this.eventBus = new mo(), this.pipeline = new si(this.eventBus), this.pipeline2 = new si(this.eventBus), this.strokeAnimator = new Hr(), this.objectStore = new Gr(), this.selectionManager = new jr(this.eventBus), this.renderer = new Gt(e, this.options.pixelRatio), this.inputManager = new pn(), this.stateMachine = new xi(this.eventBus), this.gestureEngine = new Rr((r, n) => {
      this.eventBus.emit(r, n);
    });
    const s = {
      ...Wi,
      enabled: i?.textMode ?? !1,
      ...i?.font ? { font: i.font } : {},
      ...i?.language ? { language: i.language } : {}
    };
    this.textPipeline = new yo(s, this.eventBus, this.stateMachine), this.kineticEngine = new Sr(), this.wireInput(), this.wireMorphComplete(), this.wireTextMorph(), this.renderer.setEventBus(this.eventBus), this.renderer.setEffect(this.currentEffect), this.renderer.setActivePointsSource(() => this.pipeline.getActivePoints()), this.wireStrokeAnimator(), this.wireObjectStore(), this.wireSelectionManager(), this.renderer.start(), this.stateMachine.transition("init"), s.enabled && this.textPipeline.setEnabled(!0);
  }
  bindMouse() {
    this.assertNotDestroyed(), this.pipeline.setInputSource("mouse"), this.inputManager.attachMouse(this.canvas);
  }
  async bindCamera() {
    this.assertNotDestroyed(), this.pipeline.setInputSource("camera"), this.pipeline2.setInputSource("camera"), this.inputManager.setErrorCallback((e) => {
      this.eventBus.emit("camera:denied", e);
    }), this.inputManager.setSuccessCallback(() => {
      this.eventBus.emit("camera:ready"), this.inputManager.getCameraCapture()?.setGestureCallback((e, i) => {
        this.gestureEngine.update(e, i);
      });
    }), this.inputManager.attachCamera(this.canvas);
  }
  getCameraVideoElement() {
    return this.inputManager.getCameraCapture()?.getVideoElement() ?? null;
  }
  setTwoHandDrawing(e) {
    this.assertNotDestroyed(), e ? (this.pipeline2.setInputSource("camera"), this.inputManager.setSecondHandCallbacks((i) => {
      this.pipeline2.processPoint(i);
    }, (i) => {
      i ? this.handleSecondHandPenDown() : this.handleSecondHandPenUp();
    })) : (this.inputManager.setSecondHandCallbacks(null, null), this.secondHandPenIsDown && (this.pipeline2.penUp(), this.pipeline2.reset(), this.secondHandPenIsDown = !1));
  }
  setCameraLandmarkCallback(e) {
    this.inputManager.getCameraCapture()?.setLandmarkCallback(e);
  }
  unbind() {
    this.inputManager.detachAll();
  }
  gesture(e, i) {
    this.gestureEngine.define(e, i);
  }
  getGestureEngine() {
    return this.gestureEngine;
  }
  setHandStyle(e) {
    this._handStyleName = e;
  }
  getHandStyle() {
    return this._handStyleName ?? "neon-skeleton";
  }
  _handStyleName;
  static async create(e, i) {
    const s = new ki(e, i);
    if ((i?.transparentBg ?? i?.camera) && s.setBackgroundMode("transparent"), i?.textMode && s.setTextMode(!0), i?.instantComplete && s.setInstantComplete(!0), i?.handStyle && s.setHandStyle(i.handStyle), i?.onGesture) for (const [r, n] of Object.entries(i.onGesture)) s.on(`gesture:${r}`, n);
    return i?.onReady && s.on("camera:ready", i.onReady), i?.onError && s.on("camera:denied", (r) => i.onError(r ?? /* @__PURE__ */ new Error("Camera denied"))), i?.camera && (await s.bindCamera(), i?.twoHands && s.setTwoHandDrawing(!0), i?.alwaysDraw && s.setCameraAlwaysDrawMode(!0)), s;
  }
  setEffect(e) {
    this.currentEffect = e, this.renderer.setEffect(e), this.eventBus.emit("effect:change", e), this.textPipeline.setEffect(e);
    const i = be.includes(e), s = this.renderer.type === "webgpu";
    i && !s ? this.setRenderer("webgpu").catch((r) => {
      this.eventBus.emit("error", {
        code: "RENDERER_SWITCH_FAILED",
        message: String(r)
      });
    }) : !i && s && this.setRenderer("canvas2d").catch((r) => {
      this.eventBus.emit("error", {
        code: "RENDERER_SWITCH_FAILED",
        message: String(r)
      });
    });
  }
  getEffect() {
    return this.currentEffect;
  }
  getAvailableEffects() {
    const e = [...Pi];
    return this.webgpuAvailable && e.push(...be), e;
  }
  setTextMode(e) {
    this.assertNotDestroyed(), this.textPipeline.setEnabled(e);
  }
  isTextMode() {
    return this.textPipeline.enabled;
  }
  setFont(e) {
    this.textPipeline.setFont(e);
  }
  getFont() {
    return this.textPipeline.getFont();
  }
  setTypographyMode(e) {
    this.assertNotDestroyed(), this.textPipeline.setTypographyMode(e);
  }
  getTypographyMode() {
    return this.textPipeline.getTypographyMode();
  }
  setPresetText(e) {
    this.assertNotDestroyed(), this.textPipeline.setPresetText(e);
  }
  setInstantComplete(e) {
    this.assertNotDestroyed(), this.instantComplete = e;
  }
  setWorkerUrl(e) {
    this.assertNotDestroyed(), this.inputManager.setWorkerUrl(e);
  }
  setCameraAlwaysDrawMode(e) {
    this.assertNotDestroyed(), this.inputManager.setCameraAlwaysDrawMode(e), this.inputManager.setHandVisibilityCallback((i) => {
      this.eventBus.emit(i ? "hand:found" : "hand:lost");
    });
  }
  setDrawingPaused(e) {
    this.assertNotDestroyed(), this.inputManager.setDrawingPaused(e);
  }
  setTransitMoveCallback(e) {
    this.assertNotDestroyed(), this.inputManager.setTransitMoveCallback(e);
  }
  setLayoutMode(e) {
    this.assertNotDestroyed(), this.kineticEngine.setLayoutMode(e);
  }
  getLayoutMode() {
    return this.kineticEngine.getLayoutMode();
  }
  getKineticEngine() {
    return this.kineticEngine;
  }
  animateStrokes(e, i) {
    return this.assertNotDestroyed(), this.strokeAnimator.addAnimation(e, i);
  }
  stopAnimation(e) {
    this.assertNotDestroyed(), this.strokeAnimator.removeAnimation(e);
  }
  stopAllAnimations() {
    this.assertNotDestroyed(), this.strokeAnimator.clear();
  }
  stopAnimations(e) {
    this.assertNotDestroyed();
    for (const i of e) this.strokeAnimator.removeByStrokeId(i);
  }
  setCustomColor(e) {
    this.assertNotDestroyed(), this._customColor = e;
  }
  setCustomWidth(e) {
    this.assertNotDestroyed(), this._customWidth = e;
  }
  hitTestStroke(e, i, s = 20) {
    this.assertNotDestroyed();
    const r = this.options.pixelRatio, n = e * r, o = i * r, a = s * r * (s * r);
    for (let c = this.strokes.length - 1; c >= 0; c--) {
      const l = this.strokes[c], h = l.smoothed;
      for (let d = 0; d < h.length; d++) {
        const u = h[d].x - n, p = h[d].y - o;
        if (u * u + p * p < a) return l.id;
      }
    }
    return null;
  }
  addFill(e) {
    this.assertNotDestroyed(), this.fills.push(e), this.renderer.addFill(e);
  }
  undoFill() {
    this.assertNotDestroyed();
    const e = this.renderer.removeLastFill();
    return e && (this.fills = this.fills.filter((i) => i.id !== e.id)), e;
  }
  clearFills() {
    this.assertNotDestroyed(), this.fills = [], this.renderer.clearFills();
  }
  getStrokes() {
    return this.assertNotDestroyed(), this.strokes;
  }
  getCanvasSize() {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: this.options.pixelRatio
    };
  }
  toggleStrokeAnimation(e, i) {
    if (this.assertNotDestroyed(), this.strokeAnimator.getTransform(e, performance.now()) !== null) {
      const r = this.strokeAnimator.getAnimationParams(e);
      return r && this._pausedAnimations.set(e, r), this.strokeAnimator.removeByStrokeId(e), !1;
    }
    const s = this._pausedAnimations.get(e) ?? i ?? {
      type: "sparkle",
      duration: 2e3,
      repeat: !0
    };
    return this._pausedAnimations.delete(e), this.strokeAnimator.addAnimation([e], s), !0;
  }
  createObject(e, i) {
    this.assertNotDestroyed();
    const s = i ?? this.computeStrokeBoundsForIds(e);
    return this.objectStore.createObject(e, s);
  }
  addFillToObject(e, i) {
    this.assertNotDestroyed(), this.fills.push(i), this.renderer.addFill(i), this.objectStore.addFillToObject(e, i.id);
  }
  getObjectByStrokeId(e) {
    return this.objectStore.getObjectByStrokeId(e);
  }
  getObjectByPoint(e, i, s = 20) {
    this.assertNotDestroyed();
    const r = this.hitTestStroke(e, i, s);
    if (r)
      return this.objectStore.getObjectByStrokeId(r);
  }
  getObjectStore() {
    return this.objectStore;
  }
  toggleObjectAnimation(e, i) {
    this.assertNotDestroyed();
    const s = this.objectStore.getObject(e);
    if (!s || s.strokeIds.length === 0) return !1;
    if (s.animationId) {
      const o = this.strokeAnimator.getAnimationParams(s.strokeIds[0]);
      return o && this._pausedObjectAnimations.set(e, o), this.strokeAnimator.removeAnimation(s.animationId), this.objectStore.setAnimationId(e, void 0), !1;
    }
    const r = this._pausedObjectAnimations.get(e) ?? i ?? {
      type: "sparkle",
      duration: 2e3,
      repeat: !0
    };
    this._pausedObjectAnimations.delete(e);
    const n = this.strokeAnimator.addAnimation(s.strokeIds, r);
    return this.objectStore.setAnimationId(e, n), !0;
  }
  undoObject() {
    this.assertNotDestroyed();
    const e = this.objectStore.removeLastObject();
    if (e) {
      e.animationId && this.strokeAnimator.removeAnimation(e.animationId), this._pausedObjectAnimations.delete(e.id), this.selectionManager.removeIfSelected(e.id);
      for (const i of e.strokeIds)
        this.renderer.removeStrokeById(i), this.strokes = this.strokes.filter((s) => s.id !== i), this.strokeAnimator.removeByStrokeId(i), this._pausedAnimations.delete(i);
      for (const i of e.fillIds)
        this.renderer.removeFillById(i), this.fills = this.fills.filter((s) => s.id !== i);
      return e;
    }
  }
  selectObjectAtPoint(e, i) {
    this.assertNotDestroyed();
    const s = this.hitTestStroke(e, i);
    if (!s) {
      this.selectionManager.clearSelection();
      return;
    }
    const r = this.objectStore.getObjectByStrokeId(s);
    if (!r) {
      this.selectionManager.clearSelection();
      return;
    }
    return this.selectionManager.toggle(r.id), r;
  }
  toggleObjectSelection(e) {
    this.assertNotDestroyed(), this.selectionManager.toggle(e);
  }
  clearSelection() {
    this.assertNotDestroyed(), this.selectionManager.clearSelection();
  }
  getSelectedObjectIds() {
    return [...this.selectionManager.getSelectedIds()];
  }
  hasSelection() {
    return this.selectionManager.count > 0;
  }
  polishObject(e, i) {
    this.assertNotDestroyed();
    const s = this.objectStore.getObject(e);
    if (!s || s.metadata?.correction?.corrected) return !1;
    const r = {}, n = {}, o = [], a = this.options.pixelRatio, c = Math.sqrt(s.bbox.width ** 2 + s.bbox.height ** 2), l = Math.max(60 * a, c * 0.6), h = i?.snapThreshold ? i.snapThreshold * a : l, d = [], u = 10 * a;
    for (const y of s.strokeIds) {
      const S = this.strokes.find((w) => w.id === y);
      if (!S || S.raw.length >= 6) continue;
      const M = ee(S.raw);
      M.width < u && M.height < u && d.push(y);
    }
    const p = [];
    for (const y of d) {
      const S = this.strokes.find((M) => M.id === y);
      S && p.push({
        ...S,
        raw: S.raw.map((M) => ({ ...M })),
        smoothed: S.smoothed.map((M) => ({ ...M }))
      }), r[y] = S?.raw.map((M) => ({ ...M })) ?? [], n[y] = S?.smoothed.map((M) => ({ ...M })) ?? [], this.renderer.removeStrokeById(y), this.strokes = this.strokes.filter((M) => M.id !== y), this.strokeAnimator.removeByStrokeId(y), o.push("remove-artifact");
    }
    for (const y of d) this.objectStore.removeStrokeFromObject(y);
    const f = s.strokeIds.filter((y) => !d.includes(y));
    for (const y of f) {
      const S = this.strokes.find((C) => C.id === y);
      if (!S) continue;
      r[y] = [...S.raw.map((C) => ({ ...C }))], n[y] = [...S.smoothed.map((C) => ({ ...C }))];
      const M = this.strokes.filter((C) => C.id !== y), w = {
        ...i,
        snapThreshold: h
      }, { correctedRaw: _, correctedSmoothed: N, corrections: z } = this.strokeCorrector.correctAndSmooth(S.raw, M, this.smoothStageRef, w);
      if (z.length > 0) {
        S.raw = _, S.smoothed = N;
        for (const C of z) o.includes(C) || o.push(C);
      }
    }
    if (o.length === 0) return !1;
    const m = {
      corrected: !0,
      originalRaw: r,
      originalSmoothed: n,
      removedStrokes: p.length > 0 ? p : void 0,
      appliedCorrections: o
    };
    return this.objectStore.updateMetadata(e, "correction", m), this.renderer.markDirty(), this.eventBus.emit("correction:applied", {
      objectId: e,
      corrections: o
    }), !0;
  }
  polishSelectedObjects(e) {
    for (const i of this.selectionManager.getSelectedIds()) this.polishObject(i, e);
  }
  revertObject(e) {
    this.assertNotDestroyed();
    const i = this.objectStore.getObject(e);
    if (!i) return !1;
    const s = i.metadata?.correction;
    if (!s?.corrected) return !1;
    if (s.removedStrokes) for (const r of s.removedStrokes) {
      const n = {
        ...r,
        raw: r.raw.map((o) => ({ ...o })),
        smoothed: r.smoothed.map((o) => ({ ...o }))
      };
      this.strokes.push(n), this.objectStore.addStrokeToObject(e, n.id), this.renderer.addCompletedStroke(n);
    }
    for (const r of i.strokeIds) {
      const n = this.strokes.find((o) => o.id === r);
      n && (s.originalRaw[r] && (n.raw = s.originalRaw[r].map((o) => ({ ...o }))), s.originalSmoothed[r] && (n.smoothed = s.originalSmoothed[r].map((o) => ({ ...o }))));
    }
    return this.objectStore.updateMetadata(e, "correction", void 0), this.renderer.markDirty(), this.eventBus.emit("correction:reverted", { objectId: e }), !0;
  }
  revertSelectedObjects() {
    for (const e of this.selectionManager.getSelectedIds()) this.revertObject(e);
  }
  setAutoCorrect(e) {
    this.autoCorrectEnabled = e;
  }
  isAutoCorrectEnabled() {
    return this.autoCorrectEnabled;
  }
  async setRenderer(e) {
    if (this.assertNotDestroyed(), e === "canvas2d") {
      this.replaceRenderer(null);
      return;
    }
    const i = new uo(this.canvas, this.options.pixelRatio);
    await i.init() ? (this.webgpuAvailable = !0, this.replaceRenderer(i)) : (i.destroy(), this.replaceRenderer(null), this.eventBus.emit("renderer:fallback"));
  }
  isWebGPU() {
    return this.renderer.type === "webgpu";
  }
  setBackgroundMode(e) {
    this.assertNotDestroyed(), this.renderer.setBackgroundMode(e);
  }
  clear() {
    const e = this.canvas.style;
    e.transition = `opacity ${ai}ms ease-out`, e.opacity = "0", setTimeout(() => {
      this.strokes = [], this.fills = [], this.accumulatedStrokes = [], this.strokeAnimator.clear(), this._pausedAnimations.clear(), this._pausedObjectAnimations.clear(), this.objectStore.clear(), this.renderer.clearFills(), this.renderer.clearAll(), this.pipeline.reset(), this.pipeline2.reset(), this.secondHandPenIsDown = !1, e.opacity = "1";
    }, ai);
  }
  undo() {
    const e = this.renderer.removeLastStroke();
    if (e) {
      const i = this.objectStore.getObjectByStrokeId(e.id);
      this.strokes = this.strokes.filter((s) => s.id !== e.id), this.strokeAnimator.removeByStrokeId(e.id), this._pausedAnimations.delete(e.id), this.objectStore.removeStrokeFromObject(e.id), i && i.strokeIds.length === 0 && this.selectionManager.removeIfSelected(i.id);
    }
  }
  fadeOutLastStroke(e = 500) {
    const i = this.renderer.fadeOutLastStroke(e);
    i && (this.strokes = this.strokes.filter((s) => s.id !== i.id), this.strokeAnimator.removeByStrokeId(i.id), this._pausedAnimations.delete(i.id), this.objectStore.removeStrokeFromObject(i.id));
  }
  fadeOutStrokeById(e, i = 500) {
    this.assertNotDestroyed();
    const s = this.renderer.fadeOutStrokeById(e, i);
    s && (this.strokes = this.strokes.filter((r) => r.id !== s.id), this.strokeAnimator.removeByStrokeId(s.id), this._pausedAnimations.delete(s.id), this.objectStore.removeStrokeFromObject(s.id));
  }
  getStrokeCount() {
    return this.strokes.length;
  }
  getStrokeIds() {
    return this.assertNotDestroyed(), this.strokes.map((e) => e.id);
  }
  getState() {
    return this.stateMachine.getState();
  }
  async exportPNG() {
    this.assertNotDestroyed(), this.stateMachine.transition("export_start");
    try {
      const e = await Ii(this.canvas);
      return this.stateMachine.transition("export_complete"), e;
    } catch (e) {
      throw this.stateMachine.transition("export_fail"), e;
    }
  }
  async exportGIF(e) {
    this.assertNotDestroyed(), this.stateMachine.transition("export_start");
    try {
      const i = await Ni(this.canvas, e);
      return this.stateMachine.transition("export_complete"), i;
    } catch (i) {
      throw this.stateMachine.transition("export_fail"), i;
    }
  }
  on(e, i) {
    return this.eventBus.on(e, i);
  }
  destroy() {
    this.destroyed = !0, this.overlayTimer && (clearTimeout(this.overlayTimer), this.overlayTimer = null), this.cancelMorph(), this.strokeAnimator.clear(), this._pausedAnimations.clear(), this._pausedObjectAnimations.clear(), this.selectionManager.clearSelection(), this.objectStore.clear(), this.stateMachine.destroy(), this.unbind(), this.renderer.destroy(), this.eventBus.clear(), this.strokes = [], this.fills = [], this.accumulatedStrokes = [], this.textPipeline.dispose();
  }
  wireInput() {
    this.inputManager.setPointCallback((e) => {
      this.pipeline.processPoint(e);
    }), this.inputManager.setPenStateCallback((e) => {
      e ? this.handlePenDown() : this.handlePenUp();
    });
  }
  wireMorphComplete() {
    this.eventBus.on("morph:complete", () => {
      this.completeMorph();
    });
  }
  wireTextMorph() {
    this.eventBus.on("morph:start", () => {
      const e = this.textPipeline.getMorphAnimator();
      e?.isActive() && this.renderer.setFontMorphAnimator(e);
    }), this.eventBus.on("morph:complete", () => {
      const e = this.textPipeline.getMorphAnimator();
      e && !e.isActive() && (console.info("[stroke-trace] fontMorph:complete", {
        strokesLen: this.strokes.length,
        accumulatedLen: this.accumulatedStrokes.length,
        ts: performance.now()
      }), this.renderer.setFontMorphAnimator(null));
    }), this.eventBus.on("text:overlay", (e) => {
      this.renderer.setOverlayText(e);
    });
  }
  wireStrokeAnimator() {
    this.renderer instanceof Gt && this.renderer.setStrokeAnimator(this.strokeAnimator);
  }
  wireObjectStore() {
    this.renderer instanceof Gt && this.renderer.setObjectStore(this.objectStore);
  }
  wireSelectionManager() {
    this.renderer instanceof Gt && this.renderer.setSelectionManager(this.selectionManager);
  }
  handlePenDown() {
    this.overlayTimer && (clearTimeout(this.overlayTimer), this.overlayTimer = null), this.stateMachine.getState() === "pen_up_wait" && (this.stateMachine.cancelMorphDelay(), this.pendingStroke = null), this.stateMachine.transition("penDown"), this.pipeline.reset(), this.pipeline.penDown();
  }
  handlePenUp() {
    const e = this.pipeline.penUp(), i = e?.raw.length ?? 0;
    if (this._pendingCustomColor = this._customColor, this._pendingCustomWidth = this._customWidth, this.instantComplete && e && i >= 3) {
      this.stateMachine.transition("penUp"), this.stateMachine.transition("timeout");
      let n = e.raw, o = e.smoothed;
      if (this.autoCorrectEnabled) {
        const l = this.strokeCorrector.correctAndSmooth(n, this.strokes, this.smoothStageRef, { snapThreshold: 15 * this.options.pixelRatio });
        n = l.correctedRaw, o = l.correctedSmoothed;
      }
      const a = {
        id: crypto.randomUUID(),
        raw: n,
        smoothed: o,
        state: "effected",
        effect: this.currentEffect,
        createdAt: Date.now(),
        ...this._customColor != null && { customColor: this._customColor },
        ...this._customWidth != null && { customWidth: this._customWidth }
      };
      this.strokes.push(a), this.enforceMaxStrokes(), this.renderer.addCompletedStroke(a);
      const c = this.computeStrokeBounds([e.smoothed]);
      this.eventBus.emit("stroke:complete", {
        stroke: a,
        bbox: c
      }), this.stateMachine.transition("morph_complete");
      return;
    }
    const s = this.stateMachine.getPenUpAction(i);
    if (!this.stateMachine.transition(s) || !e || s === "penUp_short") return;
    if (this.pendingStroke = e, this.textPipeline.enabled && this.accumulatedStrokes.push(e), this.textPipeline.enabled && this.textPipeline.getTypographyMode() === "overlay") {
      this.overlayTimer && clearTimeout(this.overlayTimer), this.overlayTimer = setTimeout(() => {
        this.overlayTimer = null, this.triggerTextOverlay();
      }, 2e3), this.stateMachine.startMorphDelay(() => this.startMorph());
      return;
    }
    const r = this.textPipeline.enabled ? 1500 : void 0;
    this.stateMachine.startMorphDelay(() => this.startMorph(), r);
  }
  handleSecondHandPenDown() {
    this.secondHandPenIsDown = !0, this.pipeline2.reset(), this.pipeline2.penDown();
  }
  handleSecondHandPenUp() {
    if (!this.secondHandPenIsDown) return;
    this.secondHandPenIsDown = !1;
    const e = this.pipeline2.penUp(), i = e?.raw.length ?? 0;
    if (!e || i < 3) {
      this.pipeline2.reset();
      return;
    }
    const s = {
      id: crypto.randomUUID(),
      raw: e.raw,
      smoothed: e.smoothed,
      state: "effected",
      effect: this.currentEffect,
      createdAt: Date.now(),
      ...this._customColor != null && { customColor: this._customColor },
      ...this._customWidth != null && { customWidth: this._customWidth }
    };
    this.strokes.push(s), this.enforceMaxStrokes(), this.renderer.addCompletedStroke(s), this.pipeline2.reset();
  }
  async triggerTextOverlay() {
    const e = this.strokes;
    if (e.length === 0) return;
    const i = e.map((c) => c.smoothed), s = this.computeStrokeBounds(i), r = 20;
    s.x -= r, s.y -= r, s.width += r * 2, s.height += r * 2;
    let n;
    const o = this.textPipeline.getPresetText();
    if (o) n = o;
    else {
      const { recognizeHandwriting: c } = await import("./HandwritingRecognizer-DgG8oGpQ.js"), l = await c(e.map((h) => h.raw));
      if (!l) {
        this.eventBus.emit("error", {
          code: "HANDWRITING_RECOGNITION_FAILED",
          message: "Handwriting recognition failed"
        });
        return;
      }
      n = l.text, this.eventBus.emit("text:recognized", {
        text: n,
        confidence: 1,
        characters: [],
        processingTimeMs: 0
      });
    }
    const a = dt[this.currentEffect];
    this.renderer.setOverlayText({
      text: n,
      font: this.textPipeline.getFont(),
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      effectColor: a?.color ?? "#00ffaa",
      glowColor: a?.glowColor ?? "rgba(0,255,170,0.7)",
      glowSize: a?.glowSize ?? 40,
      startTime: performance.now(),
      fadeDuration: 800
    });
  }
  startMorph() {
    this.pendingStroke && (this.stateMachine.transition("timeout"), this.morphAnimator = new Ei({
      raw: this.pendingStroke.raw,
      smoothed: this.pendingStroke.smoothed,
      effect: this.currentEffect,
      eventBus: this.eventBus
    }), this.renderer.setMorphAnimator(this.morphAnimator), this.morphAnimator.start());
  }
  completeMorph() {
    if (!this.pendingStroke || !this.morphAnimator) return;
    console.info("[stroke-trace] completeMorph:enter", {
      strokesBeforeLen: this.strokes.length,
      accumulatedLen: this.accumulatedStrokes.length,
      pendingRawLen: this.pendingStroke.raw.length,
      ts: performance.now()
    });
    let e = this.pendingStroke.raw, i = this.morphAnimator.getSmoothedPoints();
    if (this.autoCorrectEnabled) {
      const n = this.strokeCorrector.correctAndSmooth(e, this.strokes, this.smoothStageRef, { snapThreshold: 15 * this.options.pixelRatio });
      e = n.correctedRaw, i = n.correctedSmoothed;
    }
    const s = {
      id: crypto.randomUUID(),
      raw: e,
      smoothed: i,
      state: "effected",
      effect: this.currentEffect,
      createdAt: Date.now(),
      ...this._pendingCustomColor != null && { customColor: this._pendingCustomColor },
      ...this._pendingCustomWidth != null && { customWidth: this._pendingCustomWidth }
    };
    this.strokes.push(s), this.enforceMaxStrokes(), this.renderer.addCompletedStroke(s), this.renderer.setMorphAnimator(null), this.morphAnimator = null;
    const r = this.computeStrokeBounds([s.smoothed]);
    if (this.eventBus.emit("stroke:complete", {
      stroke: s,
      bbox: r
    }), this.pendingStroke = null, this.stateMachine.transition("morph_complete"), this.textPipeline.enabled && this.accumulatedStrokes.length > 0 && this.textPipeline.getTypographyMode() !== "overlay") {
      const n = [...this.accumulatedStrokes];
      this.accumulatedStrokes = [], this.textPipeline.runPipeline(n.map((o) => o.raw)).catch((o) => {
        this.eventBus.emit("error", {
          code: "TEXT_PIPELINE_FAILED",
          message: o instanceof Error ? o.message : String(o),
          stage: "text-pipeline"
        });
      });
    }
  }
  cancelMorph() {
    this.stateMachine.cancelMorphDelay(), this.morphAnimator?.cancel(), this.renderer.setMorphAnimator(null), this.morphAnimator = null, this.pendingStroke = null;
  }
  computeStrokeBounds(e) {
    return ee(e.flat());
  }
  computeStrokeBoundsForIds(e) {
    const i = [];
    for (const s of e) {
      const r = this.strokes.find((n) => n.id === s);
      r && i.push(...r.smoothed);
    }
    return i.length === 0 ? {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    } : ee(i);
  }
  enforceMaxStrokes() {
    for (; this.strokes.length > this.options.maxStrokes; ) this.strokes.shift();
  }
  assertNotDestroyed() {
    if (this.destroyed) throw new Error("Glymo instance has been destroyed");
  }
  replaceRenderer(e) {
    const i = [...this.strokes];
    this.renderer.destroy(), this.renderer = e ?? new Gt(this.canvas, this.options.pixelRatio), this.renderer.setEventBus(this.eventBus), this.renderer.setEffect(this.currentEffect), this.renderer.setActivePointsSource(() => this.pipeline.getActivePoints()), this.wireStrokeAnimator(), this.wireObjectStore(), this.wireSelectionManager();
    for (const r of i) this.renderer.addCompletedStroke(r);
    for (const r of this.fills) this.renderer.addFill(r);
    const s = this.textPipeline.getMorphAnimator();
    s?.isActive() && this.renderer.setFontMorphAnimator(s), this.renderer.start();
  }
};
export {
  Ye as BUILTIN_GESTURES,
  Fo as CascadingRecognizer,
  zi as DEFAULT_LAYOUT_OPTIONS,
  Wi as DEFAULT_TEXT_MODE_CONFIG,
  vt as DiagBus,
  dt as EFFECT_PRESETS,
  wr as FINGER_EXTEND_THRESHOLD,
  vr as FINGER_FOLD_THRESHOLD,
  Oo as GESTURE_ACTIVATE_FRAMES,
  Ro as GESTURE_DEACTIVATE_FRAMES,
  To as GIF_DURATION_MS,
  Eo as GIF_FPS,
  Po as GIF_MAX_FRAMES,
  Io as GIF_SIZE_WARN_BYTES,
  Rr as GestureEngine,
  jo as Glymo,
  Mo as GlyphExtractor,
  Ut as HAND_CONNECTIONS,
  oe as HandStateImpl,
  qt as HandStyleBase,
  Wo as HandVisualizer,
  Ho as Hologram3DRenderer,
  Go as HologramGesture,
  Sr as KineticEngine,
  Bo as LANDMARK_COUNT,
  Gr as ObjectStore,
  No as PERF_DEGRADED_CONSECUTIVE,
  Do as PERF_DEGRADED_THRESHOLD_MS,
  _o as PERF_WINDOW_SIZE,
  Le as PINCH_THRESHOLD,
  Ri as PerformanceMonitor,
  jr as SelectionManager,
  Hi as SpatialGrouper,
  Hr as StrokeAnimator,
  rn as StrokeCorrector,
  bo as TextRecognizer,
  Ui as bboxNear,
  ge as combineBbox,
  Ge as computePinchDistance,
  zo as computeSpeed,
  Ue as createHandStyle,
  Uo as executeFill,
  cr as layoutTextAlongCurve,
  hr as layoutTextInCircle,
  dr as layoutTextInShape,
  li as recognizeHandwriting,
  Vr as snapEndpoints,
  Qr as trimOvershoot,
  je as zToPressure
};

//# sourceMappingURL=glymo.mjs.map