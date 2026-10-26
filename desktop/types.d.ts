export {};
declare global {
  interface Window {
    atlasDesktop?: {
      isNative: true;
      setSurface(surface: "edge" | "brief" | "workspace"): void;
      getConfig(): Promise<{ shortcut: string; surface: "edge" | "brief" | "workspace" }>;
      onSurface(callback: (surface: "edge" | "brief" | "workspace") => void): () => void;
    };
  }
}
