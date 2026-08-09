/**
 * PdfViewerScreen
 *
 * Loads the bundled Riyad as-Salihin PDF and displays it with react-native-pdf.
 *
 * WHY THE PREVIOUS APPROACH FAILED
 * ─────────────────────────────────
 * The original code passed a raw Metro asset module number directly to
 * react-native-pdf as `source`.  react-native-pdf v7 on Android does not
 * accept a Metro module reference — it expects either:
 *   { uri: 'file:///absolute/path/to/file.pdf' }   (local file)
 *   { uri: 'https://...' }                          (remote)
 *
 * When given a module number it attempts to fetch it as a URL, which
 * fails with "Download interrupted" from react-native-blob-util.
 *
 * THE FIX
 * ───────
 * Use expo-asset (already installed) to resolve the bundled asset to a
 * guaranteed local file URI.  expo-asset copies the file to the device's
 * document/cache directory on first load and returns a stable local path.
 * That path is then passed to react-native-pdf as { uri: localUri }.
 *
 * FLOW
 *   require('…/riyad-as-salihin.pdf')    — Metro asset module
 *       ↓ Asset.fromModule().downloadAsync()
 *   file:///data/user/0/…/riyad-as-salihin.pdf   — local file URI
 *       ↓
 *   <Pdf source={{ uri: localUri }} />   — renders offline, no HTTP fetch
 *
 * NATIVE BUILD NOTE
 * ─────────────────
 * react-native-pdf contains native code.  If the current EAS development
 * client was built before react-native-pdf was linked, you will see a
 * "Native module cannot be null" error.  In that case rebuild:
 *   eas build --profile development --platform android
 */

import { Asset } from 'expo-asset';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

// Static require — Metro must be able to resolve this at build time.
// The file must exist at assets/pdf/riyad-as-salihin.pdf.
const PDF_MODULE = require('../../assets/pdf/riyad-as-salihin.pdf');

// Lazy-load react-native-pdf to produce a clean error when the native
// module is absent rather than crashing the whole app.
let Pdf = null;
let pdfModuleError = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (err) {
  pdfModuleError = err;
}

export default function PdfViewerScreen() {
  const router = useRouter();

  const [localUri, setLocalUri]   = useState(null);   // resolved local file URI
  const [page, setPage]           = useState(1);
  const [totalPages, setTotal]    = useState(0);
  const [resolving, setResolving] = useState(true);   // resolving asset to local path
  const [pdfLoading, setPdfLoading] = useState(false); // react-native-pdf is rendering
  const [error, setError]         = useState(pdfModuleError);

  // ── Step 1: resolve Metro asset → local file URI ─────────────────────
  useEffect(() => {
    if (pdfModuleError) {
      // Native module missing — skip asset resolution.
      setResolving(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setResolving(true);
        // Asset.fromModule resolves the Metro asset descriptor.
        // downloadAsync() copies it to the local filesystem if needed
        // and returns a stable file:// URI.
        const asset = Asset.fromModule(PDF_MODULE);
        await asset.downloadAsync();

        if (!cancelled) {
          if (!asset.localUri) {
            throw new Error('Asset resolved but localUri is null — the PDF file may be missing or corrupt.');
          }
          setPdfLoading(true);
          setLocalUri(asset.localUri);
        }
      } catch (err) {
        console.error('[PdfViewer] asset resolution failed:', err);
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── react-native-pdf callbacks ────────────────────────────────────────
  const handleLoadComplete = useCallback((numberOfPages) => {
    setTotal(numberOfPages);
    setPdfLoading(false);
  }, []);

  const handlePageChanged = useCallback((pageNumber) => {
    setPage(pageNumber);
  }, []);

  const handleError = useCallback((err) => {
    console.error('[PdfViewer] render error:', err);
    setError(err);
    setPdfLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setLocalUri(null);
    setPage(1);
    setTotal(0);
    setResolving(true);
    setPdfLoading(false);

    // Re-run the asset resolution.
    Asset.fromModule(PDF_MODULE)
      .downloadAsync()
      .then((asset) => {
        if (!asset.localUri) throw new Error('localUri is null after retry.');
        setPdfLoading(true);
        setLocalUri(asset.localUri);
      })
      .catch((err) => {
        console.error('[PdfViewer] retry failed:', err);
        setError(err);
      })
      .finally(() => setResolving(false));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  const isLoading = resolving || pdfLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Riyad as-Salihin
        </Text>

        <View style={styles.pageCounter}>
          {totalPages > 0 && (
            <Text style={styles.pageCounterText}>
              {page} / {totalPages}
            </Text>
          )}
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────── */}
      {error ? (
        <ErrorView error={error} onRetry={handleRetry} />
      ) : (
        <View style={styles.pdfContainer}>
          {/* Loading overlay — shown during asset resolution and PDF render */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {resolving ? 'Preparing PDF…' : 'Loading PDF…'}
              </Text>
            </View>
          )}

          {/* Render only after local URI is ready */}
          {Pdf && localUri && (
            <Pdf
              source={{ uri: localUri, cache: true }}
              style={styles.pdf}
              onLoadComplete={handleLoadComplete}
              onPageChanged={handlePageChanged}
              onError={handleError}
              enablePaging={false}
              horizontal={false}
              enableAnnotationRendering={false}
              trustAllCerts={false}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── ErrorView ────────────────────────────────────────────────────────────────

function ErrorView({ error, onRetry }) {
  const msg = error?.message ?? '';

  const isModuleError =
    msg.includes('NativeModule') ||
    msg.includes('native module') ||
    msg.includes('RNPDFPdf') ||
    msg.includes('cannot be null');

  const isCorruptFile =
    msg.includes('localUri is null') ||
    msg.includes('corrupt') ||
    msg.includes('invalid');

  let title = 'Could not load PDF';
  let body  = msg;

  if (isModuleError) {
    title = 'PDF viewer not available';
    body  =
      'The PDF viewer requires a native module not present in the current ' +
      'development build.\n\nRebuild with:\n' +
      'eas build --profile development --platform android';
  } else if (isCorruptFile) {
    title = 'PDF file error';
    body  = 'The PDF file could not be read. Make sure a valid PDF is placed at:\nassets/pdf/riyad-as-salihin.pdf';
  }

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>📄</Text>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{body}</Text>
      {!isModuleError && onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.75}
          accessibilityLabel="Retry loading PDF"
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  backButton: { minWidth: 64 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  pageCounter: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  pageCounterText: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // PDF container
  pdfContainer: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    zIndex: 10,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorIcon: { fontSize: 40, marginBottom: spacing.md },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
});
