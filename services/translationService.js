const axios = require("axios");

const MAX_TRANSLATION_LENGTH = 5000;

const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL;

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

function normalizeLanguage(language) {
  if (!language) return null;

  return (
    LANGUAGE_ALIASES[
      String(language).trim().toLowerCase()
    ] || null
  );
}

async function detectLanguage(text) {
  const response = await axios.post(
    `${LIBRETRANSLATE_URL}/detect`,
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

  return response.data?.[0]?.language || null;
}

async function translateText({
  text,
  targetLanguage,
  sourceLanguage,
}) {
  if (!LIBRETRANSLATE_URL) {
    throw new Error(
      "LIBRETRANSLATE_URL is not configured"
    );
  }

  if (!text || !text.trim()) {
    throw new Error("Text is required");
  }

  const cleanText = text.trim();

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

  if (!source) {
    source = await detectLanguage(cleanText);
  }

  if (source === target) {
    return {
      translatedText: cleanText,
      detectedSourceLanguage: source,
      targetLanguage: target,
      skipped: true,
    };
  }

  const response = await axios.post(
    `${LIBRETRANSLATE_URL}/translate`,
    {
      q: cleanText,
      source: source || "auto",
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

  if (!translatedText) {
    throw new Error(
      "LibreTranslate returned no translated text"
    );
  }

  return {
    translatedText,
    detectedSourceLanguage:
      response.data?.detectedLanguage?.language ||
      source,
    targetLanguage: target,
    skipped: false,
  };
}

module.exports = {
  translateText,
  normalizeLanguage,
  MAX_TRANSLATION_LENGTH,
};