const axios = require("axios");

const MAX_TRANSLATION_LENGTH = 5000;

const LANGUAGE_ALIASES = {
  en: "en",
  english: "en",

  sw: "sw",
  swahili: "sw",

  fr: "fr",
  french: "fr",

  es: "es",
  spanish: "es",

  de: "de",
  german: "de",

  pt: "pt",
  portuguese: "pt",

  it: "it",
  italian: "it",

  ar: "ar",
  arabic: "ar",

  hi: "hi",
  hindi: "hi",

  zh: "zh",
  "zh-cn": "zh",
  "zh_cn": "zh",
  chinese: "zh",

  ja: "ja",
  japanese: "ja",

  ko: "ko",
  korean: "ko",

  ru: "ru",
  russian: "ru",

  nl: "nl",
  dutch: "nl",

  tr: "tr",
  turkish: "tr",
};

function getLibreTranslateUrl() {
  const rawUrl = String(
    process.env.LIBRETRANSLATE_URL || ""
  ).trim();

  if (!rawUrl) {
    const error = new Error(
      "LIBRETRANSLATE_URL is not configured"
    );

    error.code = "LIBRETRANSLATE_URL_MISSING";

    throw error;
  }

  return rawUrl.replace(/\/+$/, "");
}

function normalizeLanguage(language) {
  if (!language) return null;

  const value = String(language)
    .trim()
    .toLowerCase();

  return LANGUAGE_ALIASES[value] || null;
}

function getAxiosErrorDetails(error) {
  return {
    message: error?.message,
    code: error?.code,
    status: error?.response?.status,
    data: error?.response?.data,
    url: error?.config?.url,
    method: error?.config?.method,
  };
}

async function detectLanguage(text) {
  const baseUrl = getLibreTranslateUrl();

  try {
    console.log("[TRANSLATION] Detecting language", {
      url: `${baseUrl}/detect`,
      textLength: text.length,
    });

    const response = await axios.post(
      `${baseUrl}/detect`,
      {
        q: text,
      },
      {
        timeout: 30000,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const detected =
      response.data?.[0]?.language || null;

    console.log("[TRANSLATION] Language detected", {
      language: detected,
    });

    return detected;
  } catch (error) {
    console.error(
      "[TRANSLATION] Language detection failed",
      getAxiosErrorDetails(error)
    );

    const wrapped = new Error(
      error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Language detection failed"
    );

    wrapped.status =
      error?.response?.status || 502;

    wrapped.code =
      error?.code || "TRANSLATION_DETECT_FAILED";

    wrapped.response = error?.response;

    throw wrapped;
  }
}

async function translateText({
  text,
  targetLanguage,
  sourceLanguage,
}) {
  const baseUrl = getLibreTranslateUrl();

  if (!text || typeof text !== "string") {
    throw new Error("Text is required");
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error("Text cannot be empty");
  }

  if (cleanText.length > MAX_TRANSLATION_LENGTH) {
    throw new Error(
      `Text cannot exceed ${MAX_TRANSLATION_LENGTH} characters`
    );
  }

  const target = normalizeLanguage(targetLanguage);

  if (!target) {
    throw new Error(
      `Unsupported target language: ${targetLanguage}`
    );
  }

  let source = sourceLanguage
    ? normalizeLanguage(sourceLanguage)
    : null;

  if (sourceLanguage && !source) {
    throw new Error(
      `Unsupported source language: ${sourceLanguage}`
    );
  }

  console.log("[TRANSLATION] Request", {
    url: `${baseUrl}/translate`,
    sourceLanguage: source || "auto",
    targetLanguage: target,
    textLength: cleanText.length,
  });

  /*
   * If the mobile client did not provide a source language,
   * detect it first.
   */
  if (!source) {
    source = await detectLanguage(cleanText);
  }

  /*
   * If detection failed, LibreTranslate cannot reliably
   * translate using the explicit language endpoint.
   */
  if (!source) {
    throw new Error(
      "Unable to detect source language"
    );
  }

  /*
   * No translation is necessary.
   */
  if (source === target) {
    return {
      translatedText: cleanText,
      detectedSourceLanguage: source,
      targetLanguage: target,
      skipped: true,
    };
  }

  try {
    const response = await axios.post(
      `${baseUrl}/translate`,
      {
        q: cleanText,
        source,
        target,
        format: "text",
      },
      {
        timeout: 60000,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const translatedText =
      response.data?.translatedText;

    if (
      !translatedText ||
      typeof translatedText !== "string"
    ) {
      console.error(
        "[TRANSLATION] Invalid LibreTranslate response",
        response.data
      );

      const error = new Error(
        "LibreTranslate returned no translated text"
      );

      error.status = 502;

      throw error;
    }

    console.log("[TRANSLATION] Success", {
      sourceLanguage: source,
      targetLanguage: target,
      translatedLength: translatedText.length,
    });

    return {
      translatedText,
      detectedSourceLanguage:
        response.data?.detectedLanguage?.language ||
        source,
      targetLanguage: target,
      skipped: false,
    };
  } catch (error) {
    console.error(
      "[TRANSLATION] LibreTranslate request failed",
      getAxiosErrorDetails(error)
    );

    const wrapped = new Error(
      error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "LibreTranslate request failed"
    );

    wrapped.status =
      error?.response?.status || 502;

    wrapped.code =
      error?.code || "LIBRETRANSLATE_REQUEST_FAILED";

    wrapped.response = error?.response;

    throw wrapped;
  }
}

module.exports = {
  translateText,
  normalizeLanguage,
  MAX_TRANSLATION_LENGTH,
};