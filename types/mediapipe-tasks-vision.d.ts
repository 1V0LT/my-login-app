declare module "@mediapipe/tasks-vision" {
  export class FilesetResolver {
    static forVisionTasks(basePath: string): Promise<unknown>;
  }
  export class FaceLandmarker {
    static createFromOptions(files: unknown, options: unknown): Promise<FaceLandmarker>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): {
      faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
    };
  }
  export class GestureRecognizer {
    static createFromOptions(files: unknown, options: unknown): Promise<GestureRecognizer>;
    recognizeForVideo(video: HTMLVideoElement, timestamp: number): {
      gestures?: Array<{
        categories?: Array<{ categoryName?: string; score?: number }>;
      }>;
    };
  }
  export class ObjectDetector {
    static createFromOptions(files: unknown, options: unknown): Promise<ObjectDetector>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): {
      detections?: Array<{
        categories?: Array<{ categoryName?: string; score?: number }>;
        boundingBox?: { originX: number; originY: number; width: number; height: number };
      }>;
    };
  }
}
