const axios = require("axios");

const GOOGLE_TRANSLATE_URL =
  "https://translation.googleapis.com/language/translate/v2";

const MAX_TRANSLATION_LENGTH = 5000;

function cleanText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeLanguage(language) {
  if (!language || typeof language !== "string") {
    return "en";
  }

  const value = language.trim().toLowerCase();

  const aliases = {
    english: "en",
    en: "en",

    swahili: "sw",
    kiswahili: "sw",
    sw: "sw",

    french: "fr",
    fr: "fr",

    spanish: "es",
    es: "es",

    german: "de",
    de: "de",

    portuguese: "pt",
    pt: "pt",

    italian: "it",
    it: "it",

    arabic: "ar",
    ar: "ar",

    hindi: "hi",
    hi: "hi",

    chinese: "zh",
    "zh-cn": "zh-CN",
    "zh-hans": "zh-CN",

    japanese: "ja",
    ja: "ja",

    korean: "ko",
    ko: "ko",

    russian: "ru",
    ru: "ru",

    dutch: "nl",
    nl: "nl",

    turkish: "tr",
    tr: "tr",
  };

  return aliases[value] || value;
}

async function translateText({
  text,
  targetLanguage,
  sourceLanguage = null,
}) {
  const clean = cleanText(text);

  if (!clean) {
    throw new Error("Text is required");
  }

  if (clean.length > MAX_TRANSLATION_LENGTH) {
    throw new Error(
      `Text is too long to translate. Maximum length is ${MAX_TRANSLATION_LENGTH} characters.`
    );
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_TRANSLATE_API_KEY is not configured on the server"
    );
  }

  const target = normalizeLanguage(targetLanguage);
  const source = sourceLanguage
    ? normalizeLanguage(sourceLanguage)
    : null;

  if (!target) {
    throw new Error("Target language is required");
  }

  if (source && source === target) {
    return {
      translatedText: clean,
      detectedSourceLanguage: source,
      targetLanguage: target,
      skipped: true,
    };
  }

  const params = {
    key: apiKey,
    q: clean,
    target,
    format: "text",
  };

  if (source) {
    params.source = source;
  }

  const response = await axios.post(
    GOOGLE_TRANSLATE_URL,
    null,
    {
      params,
      timeout: 15000,
    }
  );

  const translations =
    response.data?.data?.translations || [];

  if (!translations.length) {
    throw new Error("Translation service returned no translation");
  }

  const result = translations[0];

  return {
    translatedText:
      result.translatedText || clean,
    detectedSourceLanguage:
      result.detectedSourceLanguage || source || null,
    targetLanguage: target,
    skipped: false,
  };
}

module.exports = {
  translateText,
  normalizeLanguage,
  MAX_TRANSLATION_LENGTH,
};