const axios = require("axios");

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

const MAX_TRANSLATION_LENGTH = 5000;

const LANGUAGE_ALIASES = {
  auto: null,

  en: "en",
  english: "en",

  sw: "sw",
  kiswahili: "sw",
  swahili: "sw",

  fr: "fr",
  french: "fr",

  es: "es",
  spanish: "es",

  de: "de",
  german: "de",

  it: "it",
  italian: "it",

  pt: "pt",
  portuguese: "pt",

  nl: "nl",
  dutch: "nl",

  ar: "ar",
  arabic: "ar",

  hi: "hi",
  hindi: "hi",

  bn: "bn",
  bengali: "bn",

  ur: "ur",
  urdu: "ur",

  zh: "zh-CN",
  chinese: "zh-CN",
  "zh-cn": "zh-CN",

  ja: "ja",
  japanese: "ja",

  ko: "ko",
  korean: "ko",

  ru: "ru",
  russian: "ru",

  tr: "tr",
  turkish: "tr",

  pl: "pl",
  polish: "pl",

  uk: "uk",
  ukrainian: "uk",

  vi: "vi",
  vietnamese: "vi",

  id: "id",
  indonesian: "id",

  ms: "ms",
  malay: "ms",

  ro: "ro",
  romanian: "ro",

  cs: "cs",
  czech: "cs",

  el: "el",
  greek: "el",

  he: "he",
  hebrew: "he",

  fa: "fa",
  persian: "fa",

  th: "th",
  thai: "th",

  sv: "sv",
  swedish: "sv",

  da: "da",
  danish: "da",

  no: "no",
  norwegian: "no",

  fi: "fi",
  finnish: "fi",

  hu: "hu",
  hungarian: "hu",

  sk: "sk",
  slovak: "sk",

  bg: "bg",
  bulgarian: "bg",

  hr: "hr",
  croatian: "hr",

  ca: "ca",
  catalan: "ca",
};

function normalizeLanguage(language) {
  if (!language) {
    return null;
  }

  const value = String(language).trim().toLowerCase();

  return LANGUAGE_ALIASES[value] || value;
}

function cleanText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildLanguagePair(sourceLanguage, targetLanguage) {
  const source = sourceLanguage || "autodetect";
  const target = targetLanguage;

  return `${source}|${target}`;
}

async function translateText({
  text,
  targetLanguage,
  sourceLanguage = null,
}) {
  const clean = cleanText(text);

  if (!clean) {
    throw new Error("Text cannot be empty");
  }

  if (clean.length > MAX_TRANSLATION_LENGTH) {
    throw new Error(
      `Text cannot exceed ${MAX_TRANSLATION_LENGTH} characters`
    );
  }

  const target = normalizeLanguage(targetLanguage);
  const source = normalizeLanguage(sourceLanguage);

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

  const langpair = buildLanguagePair(source, target);

  try {
    const response = await axios.get(MYMEMORY_URL, {
      params: {
        q: clean,
        langpair,
      },
      timeout: 15000,
    });

    const data = response?.data;

    if (!data) {
      throw new Error("Translation service returned an empty response");
    }

    if (data.responseStatus && Number(data.responseStatus) !== 200) {
      throw new Error(
        data.responseDetails || "Translation service request failed"
      );
    }

    const translatedText =
      data?.responseData?.translatedText?.trim() || "";

    if (!translatedText) {
      throw new Error("Translation service returned no translated text");
    }

    return {
      translatedText,
      detectedSourceLanguage:
        data?.responseData?.detectedLanguage || source || null,
      targetLanguage: target,
      skipped: false,
    };
  } catch (error) {
    console.error(
      "MYMEMORY TRANSLATION ERROR:",
      error?.response?.data || error?.message || error
    );

    throw new Error(
      error?.response?.data?.responseDetails ||
        error?.message ||
        "Translation failed"
    );
  }
}

module.exports = {
  translateText,
  normalizeLanguage,
  MAX_TRANSLATION_LENGTH,
};