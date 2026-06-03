// umasim (Kotlin/WASM) と Next.js (TypeScript) を繋ぐための Adapter

export async function loadUmasimEngine() {
  try {
    // Dynamic import to avoid SSR issues
    const wasmModule = await import('./umaemu/race.js');
    console.log("Umasim engine loaded successfully:", wasmModule);
    return wasmModule;
  } catch (error) {
    console.error("Failed to load umasim engine:", error);
    throw error;
  }
}
