import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import colors from '@/constants/colors';
import {
  getCachedPdfUri,
  preparePdfAsset,
  resetPdfAssetCache,
} from '@/services/pdfAsset';

// Hide the overlay if the document is loaded but the jump to pdf_page
// has not been confirmed. Must NOT unmount <Pdf> — that aborts a still-
// running first-time page decode (the previous 20s error timeout).
const PAGE_SETTLE_MS = 12_000;
// Always open the native document at page 1. A high `page` prop becomes
// defaultPage(N) and AndroidPdfViewer will not fire onLoadComplete until
// that (possibly never-cached) page is measured/rendered.
const NATIVE_OPEN_PAGE = 1;
const RETRY_REMOUNT_MS = 240;

let Pdf = null;
let pdfModuleError = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (err) {
  pdfModuleError = err;
}

const PdfSessionContext = createContext(null);

export function clampPage(raw, totalPages) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  const page = Math.floor(n);
  if (totalPages > 0) return Math.min(page, totalPages);
  return page;
}

/**
 * One native <Pdf> for the whole process.
 *
 * The book is a single 13MB file. Remounting it on every Reader visit
 * races Pdfium teardown (react-native-pdf 7.0.4 never recycles on drop)
 * and hangs forever at "Opening the book…" with no onLoadComplete/onError.
 * Back only hides this host; the decoder stays warm.
 */
export function PdfSessionProvider({ children }) {
  const [pdfUri, setPdfUri] = useState(getCachedPdfUri);
  const [pdfResolving, setPdfResolving] = useState(() => !getCachedPdfUri());
  const [pdfReady, setPdfReady] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pdfError, setPdfError] = useState(pdfModuleError);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [visible, setVisible] = useState(false);
  const [slot, setSlot] = useState(null);
  const [openPage, setOpenPage] = useState(NATIVE_OPEN_PAGE);
  const [openKey, setOpenKey] = useState(0);
  const [presentId, setPresentId] = useState(0);
  const [mountId, setMountId] = useState(0);
  const [nativeOk, setNativeOk] = useState(true);

  const pdfReadyRef = useRef(false);
  const currentPageRef = useRef(1);
  const openPageRef = useRef(NATIVE_OPEN_PAGE);
  const retryTimerRef = useRef(null);

  pdfReadyRef.current = pdfReady;
  currentPageRef.current = currentPage;
  openPageRef.current = openPage;

  const pdfSource = useMemo(
    () => (pdfUri ? { uri: pdfUri, cache: false } : null),
    [pdfUri]
  );

  const resolvePdf = useCallback(async (cancelRef) => {
    const cached = getCachedPdfUri();
    if (cached) {
      setPdfUri(cached);
      setPdfResolving(false);
      return;
    }
    try {
      setPdfResolving(true);
      setPdfError(null);
      const uri = await preparePdfAsset();
      if (cancelRef?.current) return;
      setPdfUri(uri);
    } catch (err) {
      console.error('[PdfSession] PDF asset error:', err);
      if (!cancelRef?.current) setPdfError(err);
    } finally {
      if (!cancelRef?.current) setPdfResolving(false);
    }
  }, []);

  useEffect(() => {
    if (pdfModuleError) {
      setPdfResolving(false);
      return undefined;
    }
    const cancelRef = { current: false };
    resolvePdf(cancelRef);
    return () => { cancelRef.current = true; };
  }, [resolvePdf]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  // Document is open but the lesson page may still be rendering.
  useEffect(() => {
    if (!pdfReady || pageReady) return undefined;
    const timeoutId = setTimeout(() => setPageReady(true), PAGE_SETTLE_MS);
    return () => clearTimeout(timeoutId);
  }, [pdfReady, pageReady, mountId, presentId]);

  const present = useCallback(({ openPage: nextPage, openKey: nextKey }) => {
    const page = clampPage(nextPage, 0);
    if (__DEV__) {
      console.log('[PdfPage] session present', {
        requested: nextPage,
        clamped: page,
        openKey: nextKey,
        pdfReady: pdfReadyRef.current,
        currentPage: currentPageRef.current,
      });
    }
    openPageRef.current = page;
    setVisible(true);
    setOpenPage(page);
    setOpenKey(nextKey);
    setPresentId((n) => n + 1);
    setCurrentPage(page);
    setPageReady(Boolean(pdfReadyRef.current && currentPageRef.current === page));
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const updateSlot = useCallback((next) => {
    if (!next || !(next.width > 0) || !(next.height > 0)) return;
    const rect = {
      x: Math.round(next.x),
      y: Math.round(next.y),
      width: Math.round(next.width),
      height: Math.round(next.height),
    };
    setSlot((prev) => {
      if (
        prev &&
        prev.x === rect.x &&
        prev.y === rect.y &&
        prev.width === rect.width &&
        prev.height === rect.height
      ) {
        return prev;
      }
      return rect;
    });
  }, []);

  const handleLoadComplete = useCallback((numberOfPages) => {
    const total = typeof numberOfPages === 'number'
      ? numberOfPages
      : (numberOfPages?.numberOfPages ?? 0);
    if (__DEV__) {
      console.log('[PdfPage] onLoadComplete', {
        totalPages: total,
        openPage: openPageRef.current,
      });
    }
    setTotalPages(total);
    setPdfReady(true);
    pdfReadyRef.current = true;
    if (openPageRef.current <= NATIVE_OPEN_PAGE) setPageReady(true);
  }, []);

  const handlePageChanged = useCallback((page) => {
    const p = typeof page === 'number' ? page : page?.page ?? page;
    if (typeof p !== 'number' || p < 1) return;
    if (__DEV__) {
      console.log('[PdfPage] onPageChanged', {
        actual: p,
        openPage: openPageRef.current,
      });
    }
    currentPageRef.current = p;
    setCurrentPage((prev) => (prev === p ? prev : p));
    if (p === openPageRef.current) setPageReady(true);
  }, []);

  const handleError = useCallback((err) => {
    console.error('[PdfSession] PDF render error:', err);
    setPdfError(err);
    setPdfReady(false);
    pdfReadyRef.current = false;
  }, []);

  const retry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setPdfReady(false);
    pdfReadyRef.current = false;
    setPageReady(false);
    setPdfError(null);
    setTotalPages(0);
    setNativeOk(false);
    if (!getCachedPdfUri()) {
      resetPdfAssetCache();
      setPdfUri(null);
      resolvePdf({ current: false });
    }
    // Let onDropViewInstance.recycle() finish before the next native mount.
    retryTimerRef.current = setTimeout(() => {
      setMountId((n) => n + 1);
      setNativeOk(true);
    }, RETRY_REMOUNT_MS);
  }, [resolvePdf]);

  const value = useMemo(() => ({
    pdfResolving,
    pdfReady,
    pageReady,
    pdfError,
    currentPage,
    totalPages,
    present,
    hide,
    updateSlot,
    retry,
  }), [
    pdfResolving,
    pdfReady,
    pageReady,
    pdfError,
    currentPage,
    totalPages,
    present,
    hide,
    updateSlot,
    retry,
  ]);

  return (
    <PdfSessionContext.Provider value={value}>
      <View style={styles.shell} collapsable={false}>
        {children}
        <PersistentPdfHost
          visible={visible}
          slot={slot}
          pdfSource={pdfSource}
          pdfError={pdfError}
          openPage={openPage}
          openKey={openKey}
          presentId={presentId}
          mountId={mountId}
          nativeOk={nativeOk}
          onLoadComplete={handleLoadComplete}
          onPageChanged={handlePageChanged}
          onError={handleError}
        />
      </View>
    </PdfSessionContext.Provider>
  );
}

export function usePdfSession() {
  const context = useContext(PdfSessionContext);
  if (!context) {
    throw new Error('usePdfSession must be used within a PdfSessionProvider');
  }
  return context;
}

function PersistentPdfHost({
  visible,
  slot,
  pdfSource,
  pdfError,
  openPage,
  openKey,
  presentId,
  mountId,
  nativeOk,
  onLoadComplete,
  onPageChanged,
  onError,
}) {
  const hasSlot = Boolean(slot && slot.width > 0 && slot.height > 0);
  if (!hasSlot || !pdfSource) return null;

  const show = visible && !pdfError;

  return (
    <View
      pointerEvents={show ? 'auto' : 'none'}
      collapsable={false}
      removeClippedSubviews={false}
      style={[
        styles.host,
        {
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
        },
        !show && styles.hostHidden,
      ]}
    >
      {nativeOk ? (
        <BookPdf
          key={mountId}
          source={pdfSource}
          openPage={openPage}
          openKey={openKey}
          presentId={presentId}
          onLoadComplete={onLoadComplete}
          onPageChanged={onPageChanged}
          onError={onError}
        />
      ) : null}
    </View>
  );
}

// Memoized native PDF: parent page-counter / play-pause re-renders must not touch it.
//
// CRITICAL: react-native-pdf Android calls drawPdf() on EVERY native prop update
// (PdfManager.onAfterUpdateTransaction). Changing the `page` prop therefore
// re-parses the entire book and can deadlock Pdfium if a previous decode is live.
// Always mount at page 1; jump to the lesson page with setPage() after load.
const BookPdf = memo(function BookPdf({
  source,
  openPage,
  openKey,
  presentId,
  onLoadComplete,
  onPageChanged,
  onError,
}) {
  const pdfRef = useRef(null);
  const readyRef = useRef(false);
  const positionedRef = useRef(false);
  const [docReady, setDocReady] = useState(false);
  const openPageRef = useRef(openPage);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onPageChangedRef = useRef(onPageChanged);

  openPageRef.current = openPage;
  onLoadCompleteRef.current = onLoadComplete;
  onPageChangedRef.current = onPageChanged;

  const targetPage = clampPage(openPage, 0);
  const nativePage = docReady ? targetPage : NATIVE_OPEN_PAGE;

  const applyLessonPage = useCallback(() => {
    if (!readyRef.current) return;
    const target = clampPage(openPageRef.current, 0);
    if (__DEV__) {
      console.log('[PdfPage] applyLessonPage', { target });
    }
    try {
      pdfRef.current?.setPage?.(target);
    } catch (err) {
      console.warn('[BookPdf] setPage failed:', err);
    }
  }, []);

  const markDocumentReady = useCallback((numberOfPages) => {
    const alreadyReady = readyRef.current;
    if (!alreadyReady) {
      readyRef.current = true;
      setDocReady(true);
      onLoadCompleteRef.current?.(numberOfPages);
    }
    applyLessonPage();
  }, [applyLessonPage]);

  useEffect(() => {
    positionedRef.current = false;
    if (!readyRef.current) return;
    applyLessonPage();
  }, [openKey, openPage, presentId, applyLessonPage]);

  const handleLoadComplete = useCallback((numberOfPages, ...rest) => {
    if (__DEV__) {
      console.log('[PdfPage] loadComplete', {
        numberOfPages,
        requested: openPageRef.current,
      });
    }
    markDocumentReady(numberOfPages, ...rest);
  }, [markDocumentReady]);

  const handlePageChanged = useCallback((page, numberOfPages) => {
    const actual = typeof page === 'number' ? page : page?.page ?? page;
    if (typeof actual !== 'number' || actual < 1) return;

    const requested = clampPage(openPageRef.current, 0);

    if (!readyRef.current) {
      if (__DEV__) {
        console.log('[PdfPage] firstPaint', { actual, requested, numberOfPages });
      }
      markDocumentReady(numberOfPages);
      return;
    }

    if (!positionedRef.current) {
      if (actual === requested) {
        positionedRef.current = true;
        if (__DEV__) {
          console.log('[PdfPage] initialPositioned', { actual });
        }
        onPageChangedRef.current?.(actual, numberOfPages);
      } else if (__DEV__) {
        console.log('[PdfPage] ignoreUntilPositioned', { actual, requested });
      }
      return;
    }

    onPageChangedRef.current?.(actual, numberOfPages);
  }, [markDocumentReady]);

  if (!Pdf || !source) return null;

  if (__DEV__) {
    console.log('[PdfPage] native page prop', { nativePage, targetPage, docReady });
  }

  return (
    <Pdf
      ref={pdfRef}
      source={source}
      style={styles.pdf}
      page={nativePage}
      onLoadComplete={handleLoadComplete}
      onPageChanged={handlePageChanged}
      onError={onError}
      renderActivityIndicator={() => null}
      horizontal={false}
      enablePaging={false}
      enableAnnotationRendering={false}
      enableDoubleTapZoom
      trustAllCerts={false}
      fitPolicy={0}
      minScale={1}
      maxScale={4}
      spacing={6}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
});

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  host: {
    position: 'absolute',
    zIndex: 2,
    elevation: 2,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  hostHidden: {
    opacity: 0,
    transform: [{ translateX: 10000 }],
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.paper,
  },
});
