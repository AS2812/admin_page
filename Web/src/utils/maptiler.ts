// MapTiler SDK + Client global configuration
// Imports SDK CSS once so map controls render correctly
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { config as maptilerConfig } from "@maptiler/sdk";
import { config as clientConfig } from "@maptiler/client";

interface MetaEnv { MAPTILER_KEY?: string }

// Read API key from multiple env prefixes that this project uses
const keyVite = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
const keyNext = import.meta.env.NEXT_PUBLIC_MAPTILER_KEY as string | undefined;
// access Vite/Next-like env slot (ts doesn't recognize MAPTILER_ prefix)
const keyBare = (import.meta as unknown as { env?: MetaEnv })?.env?.MAPTILER_KEY;
const apiKey = keyNext || keyVite || keyBare || "";

// Configure both SDK and Client once at app startup
maptilerConfig.apiKey = apiKey;
clientConfig.apiKey = apiKey;

if (!apiKey) {
	console.warn("MapTiler API key not found. Map features that require MapTiler will fall back.");
}

export function getMapTilerKey() {
	return apiKey;
}

// Optional helpers (typed) for geocoding and static maps
export { geocoding, staticMaps } from "@maptiler/client";