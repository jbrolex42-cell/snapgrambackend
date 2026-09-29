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

    console.log("[TRANSLATION REQUEST]", {
      textLength: cleanText.length,
      sourceLanguage: source,
      targetLanguage: target,
    });

    const result = await translateText({
      text: cleanText,
      targetLanguage: target,
      sourceLanguage: source,
    });

    console.log("[TRANSLATION SUCCESS]", {
      targetLanguage: target,
    });

    return res.json({
      success: true,
      translation: result,
    });
  } catch (error) {
    console.error("[TRANSLATION ERROR]", {
      message: error?.message,
      status: error?.status,
      responseStatus: error?.response?.status,
      responseData: error?.response?.data,
      code: error?.code,
      stack: error?.stack,
    });

    const status =
      Number(error?.status) ||
      Number(error?.response?.status) ||
      502;

    return res.status(status >= 400 && status < 600 ? status : 502).json({
      success: false,
      message: "Translation service unavailable",
      error: error?.message || "Translation failed",
    });
  }
}

module.exports = {
  translateContent,
};