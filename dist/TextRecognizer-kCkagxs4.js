var o = 960, a = 700, h = 4, l = class {
  tesseractWorker = null;
  loading = null;
  config;
  constructor(e) {
    this.config = { ...e };
  }
  async initialize() {
    if (!this.tesseractWorker)
      return this.loading ? this.loading : (this.loading = (async () => {
        try {
          this.tesseractWorker = await (await import("./core-BmZcfrrT.js")).createWorker(this.config.language);
        } catch {
          throw this.loading = null, new Error("TESSERACT_LOAD_FAILED");
        }
      })(), this.loading);
  }
  async recognize(e) {
    if (e.length === 0 || e.every((n) => n.length === 0)) throw new Error("NO_STROKES");
    const t = performance.now();
    await this.initialize();
    const r = this.renderStrokesToCanvas(e), i = this.tesseractWorker;
    try {
      const { data: n } = await i.recognize(r), c = performance.now() - t, s = this.extractCharacters(n.symbols);
      return {
        text: n.text.trim(),
        confidence: n.confidence / 100,
        characters: s.slice(0, this.config.maxChars),
        processingTimeMs: c
      };
    } catch {
      throw new Error("OCR_FAILED");
    }
  }
  renderStrokesToCanvas(e) {
    const t = new OffscreenCanvas(o, a), r = t.getContext("2d");
    r.fillStyle = "#ffffff", r.fillRect(0, 0, o, a), r.strokeStyle = "#000000", r.lineWidth = h, r.lineCap = "round", r.lineJoin = "round";
    for (const i of e)
      if (!(i.length < 2)) {
        r.beginPath(), r.moveTo(i[0].x, i[0].y);
        for (let n = 1; n < i.length; n++) r.lineTo(i[n].x, i[n].y);
        r.stroke();
      }
    return t;
  }
  extractCharacters(e) {
    return e ? e.map((t) => ({
      char: t.text,
      confidence: t.confidence / 100,
      bbox: {
        x: t.bbox.x0,
        y: t.bbox.y0,
        width: t.bbox.x1 - t.bbox.x0,
        height: t.bbox.y1 - t.bbox.y0
      }
    })) : [];
  }
  updateConfig(e) {
    Object.assign(this.config, e);
  }
  async dispose() {
    this.tesseractWorker && (await this.tesseractWorker.terminate(), this.tesseractWorker = null), this.loading = null;
  }
};
export {
  l as t
};

//# sourceMappingURL=TextRecognizer-kCkagxs4.js.map