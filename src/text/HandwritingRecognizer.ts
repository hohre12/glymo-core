/**
 * Handwriting recognition using Google Input Tools API.
 * Free, no API key required. Takes stroke coordinates and returns recognized text.
 * Same engine as Google Translate's handwriting input.
 */

import type { StrokePoint } from '../types.js';

const DEFAULT_LANGUAGE = 'en';

function buildApiUrl(language: string): string {
  return `https://inputtools.google.com/request?itc=${language}-t-i0-handwrit&app=glymo`;
}

interface GoogleHandwritingRequest {
  app_version: number;
  api_level: string;
  device: string;
  input_type: number;
  options: string;
  requests: Array<{
    writing_guide: { writing_area_width: number; writing_area_height: number };
    ink: number[][][]; // [stroke][dimension][values] — stroke = [[x0,x1,...], [y0,y1,...], [t0,t1,...]]
    language: string;
  }>;
}

/**
 * Recognize handwritten text from stroke data using Google's free Handwriting API.
 * Returns the best text candidate, or null if recognition fails.
 */
export async function recognizeHandwriting(
  strokeArrays: StrokePoint[][],
  language: string = DEFAULT_LANGUAGE,
  canvasWidth: number = 1000,
  canvasHeight: number = 600,
): Promise<{ text: string; candidates: string[] } | null> {
  if (strokeArrays.length === 0) return null;

  // Convert StrokePoint[][] to Google's ink format: [[[x0,x1,...],[y0,y1,...],[t0,t1,...]],...]
  const ink: number[][][] = strokeArrays.map(stroke => {
    const xs: number[] = [];
    const ys: number[] = [];
    const ts: number[] = [];
    for (const pt of stroke) {
      xs.push(Math.round(pt.x));
      ys.push(Math.round(pt.y));
      ts.push(Math.round(pt.t));
    }
    return [xs, ys, ts];
  });

  const payload: GoogleHandwritingRequest = {
    app_version: 0.4,
    api_level: '537.36',
    device: 'glymo-web',
    input_type: 0,
    options: 'enable_pre_space',
    requests: [{
      writing_guide: {
        writing_area_width: canvasWidth,
        writing_area_height: canvasHeight,
      },
      ink,
      language,
    }],
  };

  try {
    const response = await fetch(buildApiUrl(language || DEFAULT_LANGUAGE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Response format: ["SUCCESS", [["", [candidate1, candidate2, ...], ...]]]
    if (data[0] !== 'SUCCESS' || !data[1]?.[0]?.[1]) return null;

    const candidates: string[] = data[1][0][1];
    if (candidates.length === 0) return null;

    return {
      text: candidates[0]!,
      candidates,
    };
  } catch {
    return null;
  }
}
