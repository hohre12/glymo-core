var a = "en";
function h(e) {
  return `https://inputtools.google.com/request?itc=${e}-t-i0-handwrit&app=glymo`;
}
async function d(e, r = a, u = 1e3, p = 600) {
  if (e.length === 0) return null;
  const c = e.map((i) => {
    const t = [], n = [], s = [];
    for (const o of i)
      t.push(Math.round(o.x)), n.push(Math.round(o.y)), s.push(Math.round(o.t));
    return [
      t,
      n,
      s
    ];
  }), l = {
    app_version: 0.4,
    api_level: "537.36",
    device: "glymo-web",
    input_type: 0,
    options: "enable_pre_space",
    requests: [{
      writing_guide: {
        writing_area_width: u,
        writing_area_height: p
      },
      ink: c,
      language: r
    }]
  };
  try {
    const i = await fetch(h(r || a), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(l)
    });
    if (!i.ok) return null;
    const t = await i.json();
    if (t[0] !== "SUCCESS" || !t[1]?.[0]?.[1]) return null;
    const n = t[1][0][1];
    return n.length === 0 ? null : {
      text: n[0],
      candidates: n
    };
  } catch {
    return null;
  }
}
export {
  d as t
};

//# sourceMappingURL=HandwritingRecognizer-CfzITxxh.js.map