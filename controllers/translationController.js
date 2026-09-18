const {
  translateText,
  normalizeLanguage,
  MAX_TRANSLATION_LENGTH,
} = require("../services/translationService");

async function translateContent(req, res) {
  try {
    const {
      text,
      targetLanguage,
      sourceLanguage,
    } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Text is required",
      });
    }

    const cleanText = text.trim();

    if (!cleanText) {
      return res.status(400).json({
        success: false,
        message: "Text cannot be empty",
      });
    }

    if (cleanText.length > MAX_TRANSLATION_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Text cannot exceed ${MAX_TRANSLATION_LENGTH} characters`,
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        message: "Target language is required",
      });
    }

    const target = normalizeLanguage(targetLanguage);
    const source = sourceLanguage
      ? normalizeLanguage(sourceLanguage)
      : null;

    if (!target) {
      return res.status(400).json({
        success: false,
        message: "Invalid target language",
      });
    }

    if (source && source === target) {
      return res.json({
        success: true,
        translation: {
          translatedText: cleanText,
          detectedSourceLanguage: source,
          targetLanguage: target,
          skipped: true,
        },
      });
    }

    const result = await translateText({
      text: cleanText,
      targetLanguage: target,
      sourceLanguage: source,
    });

    return res.json({
      success: true,
      translation: result,
    });
  } catch (error) {
    console.error(
      "TRANSLATION ERROR:",
      error?.response?.data || error?.message || error
    );

    return res.status(500).json({
      success: false,
      message: error?.message || "Translation failed",
    });
  }
}

module.exports = {
  translateContent,
};