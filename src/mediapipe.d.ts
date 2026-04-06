declare module '@mediapipe/tasks-vision' {
  interface HandLandmark {
    x: number;
    y: number;
    z: number;
  }

  interface HandLandmarkerResult {
    landmarks: HandLandmark[][];
    handedness: Array<Array<{ categoryName: string }>>;
  }

  interface HandLandmarkerOptions {
    baseOptions: {
      modelAssetPath: string;
      delegate?: string;
    };
    runningMode: string;
    numHands?: number;
    minHandDetectionConfidence?: number;
    minHandPresenceConfidence?: number;
    minTrackingConfidence?: number;
  }

  class HandLandmarker {
    static createFromOptions(
      vision: unknown,
      options: HandLandmarkerOptions,
    ): Promise<HandLandmarker>;
    detectForVideo(
      video: HTMLVideoElement,
      timestamp: number,
    ): HandLandmarkerResult;
    close(): void;
  }

  class FilesetResolver {
    static forVisionTasks(wasmPath: string): Promise<unknown>;
  }
}
