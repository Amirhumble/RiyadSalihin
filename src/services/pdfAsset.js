import { Asset } from 'expo-asset';

// Bundled book. Resolved to a real file:// URI once per process.
const PDF_MODULE = require('../../assets/pdf/riyad-as-salihin.pdf');

let cachedUri = null;
let inflight = null;

export function getCachedPdfUri() {
  return cachedUri;
}

/**
 * Copy the bundled PDF into a usable local file (once).
 * Safe to call from multiple screens — shares one in-flight promise.
 * This does NOT mount <Pdf> / parse the document.
 */
export function preparePdfAsset() {
  if (cachedUri) return Promise.resolve(cachedUri);
  if (!inflight) {
    inflight = (async () => {
      try {
        const asset = Asset.fromModule(PDF_MODULE);
        await asset.downloadAsync();
        if (!asset.localUri) {
          throw new Error('PDF could not be prepared.');
        }
        cachedUri = asset.localUri;
        return cachedUri;
      } catch (err) {
        inflight = null;
        throw err;
      }
    })();
  }
  return inflight;
}

export function resetPdfAssetCache() {
  cachedUri = null;
  inflight = null;
}
