let pdfjsLibPromise;

async function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjsLib;
    });
  }

  return pdfjsLibPromise;
}

export async function extractPdfTextInBrowser(arrayBuffer, options = {}) {
  const pdfjsLib = await getPdfjsLib();
  const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : 80;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageLimit = Math.min(pdf.numPages, maxPages);
  let text = '';

  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item?.str || '')
        .filter(Boolean)
        .join(' ');

      if (pageText.trim()) {
        text += `${pageText}\n\n`;
      }

      page.cleanup();
    }

    return {
      text,
      pageCount: pdf.numPages,
      parsedPageCount: pageLimit,
      truncatedPages: pdf.numPages > pageLimit
    };
  } finally {
    await loadingTask.destroy();
  }
}
