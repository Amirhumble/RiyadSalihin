/**
 * PdfViewerScreen
 *
 * Loads and displays the bundled Riyad as-Salihin PDF from assets/pdf/.
 *
 * Dependencies (already in package.json):
 *   react-native-pdf       v7.0.4
 *   react-native-blob-util (peer dep, also installed)
 *
 * IMPORTANT — NATIVE BUILD NOTE
 * ──────────────────────────────
 * react-native-pdf contains native code (iOS/Android PDF rendering).
 * If the current EAS development client was built before react-native-pdf
 * was added to package.json, the NativeModule will not be present and
 * the PDF viewer will throw:
 *
 *   "Native module cannot be null" (iOS)
 *   "Unable to resolve module RNPDFPdf" (Android)
 *
 * In that case a new development build is required:
 *   eas build --profile development --platform android
 *
 * The app handles this gracefully — if the module is missing, the error
 * state displays a clear message instead of crashing.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

// Statically referenced asset — Metro bundles this at build time.
// Place the real PDF at: assets/pdf/riyad-as-salihin.pdf
const PDF_ASSET = require('../../assets/pdf/riyad-as-salihin.pdf');

// Lazily require react-native-pdf so a missing native module produces a
// clean error state rather than crashing the whole app.
let Pdf = null;
let pdfLoadError = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (err) {
  pdfLoadError = err;
}

export default function PdfViewerScreen() {
  const router = useRouter();
  const [page, setPage]         = useState(1);
  const [totalPages, setTotal]  = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(pdfLoadError);

  const handleLoadComplete = useCallback((numberOfPages) => {
    setTotal(numberOfPages);
    setLoading(false);
  }, []);

  const handlePageChanged = useCallback((pageNumber) => {
    setPage(pageNumber);
  }, []);

  const handleError = useCallback((err) => {
    console.error('[PdfViewer] error:', err);
    setError(err);
    setLoading(false);
  }, []);

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
        <ErrorView error={error} />
      ) : (
        <View style={styles.pdfContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading PDF…</Text>
            </View>
          )}
          {Pdf && (
            <Pdf
              source={PDF_ASSET}
              style={styles.pdf}
              onLoadComplete={handleLoadComplete}
              onPageChanged={handlePageChanged}
              onError={handleError}
              enablePaging
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

function ErrorView({ error }) {
  const isModuleError =
    error?.message?.includes('NativeModule') ||
    error?.message?.includes('native module') ||
    error?.message?.includes('RNPDFPdf') ||
    error?.message?.includes('cannot be null');

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>📄</Text>
      <Text style={styles.errorTitle}>
        {isModuleError ? 'PDF viewer not available' : 'Could not load PDF'}
      </Text>
      <Text style={styles.errorMessage}>
        {isModuleError
          ? 'The PDF viewer requires a native module that is not present in the ' +
            'current development build.\n\n' +
            'Run:\n  eas build --profile development --platform android\n\n' +
            'to include react-native-pdf in the development client.'
          : error?.message ?? 'An unknown error occurred.'}
      </Text>
    </View>
  );
}

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

  // PDF
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
    marginBottom: spacing.md,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
