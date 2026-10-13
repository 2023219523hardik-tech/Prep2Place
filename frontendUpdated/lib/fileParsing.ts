import mammoth from "mammoth";

export interface ExtractResult {
  text: string;
  /** Set when extraction "succeeded" (didn't throw) but the result is suspicious enough that the
   *  caller should show a specific warning rather than silently trusting an empty/near-empty
   *  result - e.g. a scanned PDF with no embedded text layer. */
  warning?: string;
}

export class FileParseError extends Error {}

let workerConfigured = false;

/** pdfjs-dist requires GlobalWorkerOptions.workerSrc to be set before first use, or every call
 *  throws immediately - this was the actual root cause of "Could not read that file" firing for
 *  every PDF regardless of content, since that failure was being swallowed into one generic
 *  message. Configured once, from a static file in /public rather than a bundler-resolved worker
 *  URL, which is the most reliable way to serve this asset from a Next.js app. */
async function ensurePdfWorkerConfigured(pdfjsLib: any) {
  if (workerConfigured) return;
  try {
    if (typeof window !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }
  workerConfigured = true;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Extracts plain text from a resume/JD upload. Throws FileParseError with a specific, actionable
 * message per failure mode (Section 6: "clear, specific error messages... vs a generic failure")
 * rather than one blanket "could not read that file" for every case.
 *
 * Note on scope: this extracts the text layer already embedded in text-based PDFs/DOCX/TXT/MD -
 * the large majority of resumes exported from Word, Google Docs, LaTeX, or Canva all have one.
 * It does NOT run OCR on scanned/image-only PDFs (a photographed or scanned resume with no text
 * layer) - that would need a client-side OCR engine (e.g. tesseract.js) with its own worker/wasm
 * asset pipeline and real accuracy caveats on resume-style layouts, which is a meaningfully
 * bigger and less reliable addition than fixing this confirmed root cause. Scanned PDFs get a
 * specific, honest error telling the candidate to paste the text instead, rather than a fake
 * OCR pass that might silently produce garbled text.
 */
export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileParseError("This file is larger than 2 MB. Please choose a smaller file or paste the text directly.");
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return extractFromPdf(file);
  }
  if (name.endsWith(".docx")) {
    return extractFromDocx(file);
  }
  if (name.endsWith(".doc")) {
    try {
      return await extractFromDocx(file);
    } catch {
      throw new FileParseError("This .doc file format could not be read directly. Please save or export your document as a .docx or PDF file, or paste your resume text directly.");
    }
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    const text = await file.text();
    if (!text.trim()) throw new FileParseError("That file appears to be empty.");
    return { text };
  }

  throw new FileParseError(`Unsupported file type "${file.name.split(".").pop() || ""}". Use a PDF, DOCX, TXT, or Markdown file.`);
}

function extractRawTextFromPdfBuffer(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(bytes);

    // Look for standard PDF text elements: (string) Tj or [(strings)] TJ
    const textPieces: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      const cleaned = match[1].replace(/\\([()\\])/g, "$1").trim();
      if (cleaned.length > 0) {
        textPieces.push(cleaned);
      }
    }

    if (textPieces.length > 5) {
      return textPieces.join(" ");
    }

    const words = raw.match(/[a-zA-Z0-9.,@/:+ -]{4,}/g) || [];
    const candidateLines = words
      .map((w) => w.trim())
      .filter((w) => w.length > 3 && !w.startsWith("<<") && !w.startsWith("obj") && !w.startsWith("endobj") && !w.startsWith("stream") && !w.includes("/Filter") && !w.includes("/Length"));

    if (candidateLines.length > 10) {
      return candidateLines.join(" ");
    }
  } catch (e) {
    console.warn("Raw PDF buffer fallback failed:", e);
  }
  return "";
}

async function extractFromPdf(file: File): Promise<ExtractResult> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  let pdfjsLib: any = null;
  try {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    await ensurePdfWorkerConfigured(pdfjsLib);
  } catch (err) {
    console.warn("Could not load pdfjs library, using fallback parser:", err);
  }

  let text = "";
  if (pdfjsLib) {
    try {
      const pdf = await pdfjsLib.getDocument({
        data,
        standardFontDataUrl: "/pdf-standard-fonts/",
      }).promise;

      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: any) => ("str" in item ? item.str : "")).join(" "));
      }
      text = pages.join("\n").trim();
    } catch (primaryErr: any) {
      console.warn("PDF.js primary extraction failed, trying main-thread fallback:", primaryErr);
      const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (/password/i.test(msg)) {
        throw new FileParseError("This PDF is password-protected. Please remove the password or paste the text directly.");
      }
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
        const fallbackPdf = await pdfjsLib.getDocument({ data }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= fallbackPdf.numPages; pageNumber += 1) {
          const page = await fallbackPdf.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => ("str" in item ? item.str : "")).join(" "));
        }
        text = pages.join("\n").trim();
      } catch (secondaryErr) {
        console.warn("PDF.js fallback failed, using raw buffer parser:", secondaryErr);
        text = extractRawTextFromPdfBuffer(arrayBuffer);
      }
    }
  } else {
    text = extractRawTextFromPdfBuffer(arrayBuffer);
  }

  if (!text) {
    throw new FileParseError(
      "This PDF appears to be a scanned image — no embedded text was found. Please paste the text directly, or upload a text-based export of the document."
    );
  }
  if (text.length < 40) {
    return { text, warning: "Only a small amount of text was found in this PDF — please check the preview below and paste the full text if anything looks missing." };
  }
  return { text };
}

async function extractFromDocx(file: File): Promise<ExtractResult> {
  let result;
  try {
    result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  } catch {
    throw new FileParseError("This DOCX file could not be opened — it may be corrupted. Please try re-saving it, or paste the text directly.");
  }
  const text = result.value.trim();
  if (!text) {
    throw new FileParseError("No readable text was found in this DOCX file. Please paste the text directly.");
  }
  return { text, warning: result.messages.length > 0 ? "Some formatting in this document couldn't be converted — please check the preview below." : undefined };
}
