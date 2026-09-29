const BASE_URL =
  process.env.EPIDEMIC_SOUND_API_URL ||
  "https://partner-content-api.epidemicsound.com";

const API_KEY = process.env.EPIDEMIC_SOUND_API_KEY;

function assertConfigured() {
  if (!API_KEY) {
    const error = new Error(
      "EPIDEMIC_SOUND_API_KEY is not configured"
    );

    error.status = 500;
    throw error;
  }
}

async function epidemicRequest(path, options = {}) {
  assertConfigured();

  const url = `${BASE_URL}${path}`;

  console.log("[EPIDEMIC REQUEST]", {
    url,
    method: options.method || "GET",
    hasApiKey: Boolean(API_KEY),
  });

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers || {}),
    },
  });

  const rawText = await response.text();

  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!response.ok) {
    console.error("[EPIDEMIC ERROR]", {
      status: response.status,
      statusText: response.statusText,
      data,
      url,
    });

    const error = new Error(
      data?.message ||
        data?.error ||
        `Epidemic API error ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  console.log("[EPIDEMIC RESPONSE]", {
    status: response.status,
    url,
    type: Array.isArray(data)
      ? "array"
      : typeof data,
    keys:
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
        ? Object.keys(data)
        : [],
    trackCount: Array.isArray(data?.tracks)
      ? data.tracks.length
      : Array.isArray(data?.data)
      ? data.data.length
      : Array.isArray(data?.results)
      ? data.results.length
      : undefined,
  });

  return data;
}

function normalizeTrack(track) {
  if (!track) {
    return null;
  }

  const id =
    track.id ||
    track.trackId ||
    track.uuid ||
    "";

  if (!id) {
    return null;
  }

  const artist =
    track.artist?.name ||
    track.artist ||
    track.artists?.[0]?.name ||
    "";

  const album =
    track.album?.name ||
    track.album ||
    "";

  const artworkUrl =
    track.coverArt?.url ||
    track.coverArt ||
    track.cover?.url ||
    track.cover ||
    track.image?.url ||
    track.image ||
    track.imageUrl ||
    "";

  let durationMs = Number(
    track.durationMs ||
      track.duration_ms ||
      0
  );

  if (!durationMs && track.duration != null) {
    const durationNumber = Number(track.duration);

    if (Number.isFinite(durationNumber)) {
      durationMs =
        durationNumber < 10000
          ? durationNumber * 1000
          : durationNumber;
    }
  }

  /*
   * IMPORTANT:
   *
   * Do not force audioUrl to "".
   *
   * Different provider responses may expose a playable/preview
   * URL under different fields. Preserve one if the provider
   * actually supplies it.
   */
  const audioUrl =
    track.audioUrl ||
    track.audioURL ||
    track.previewUrl ||
    track.previewURL ||
    track.streamUrl ||
    track.streamURL ||
    track.playbackUrl ||
    track.playbackURL ||
    track.url ||
    "";

  const providerTrackId = String(id);

  return {
    id: providerTrackId,

    title:
      track.title ||
      track.name ||
      "",

    artist,

    album,

    artworkUrl,

    audioUrl,

    durationMs,

    /*
     * This URL points back to Snapgram's authenticated preview
     * endpoint. The mobile app can use it when the provider's
     * search response doesn't contain a direct audio URL.
     */
    previewUrl:
      `/music/${encodeURIComponent(
        providerTrackId
      )}/preview`,

    duration: durationMs,

    provider: "epidemic",

    providerTrackId,

    genre:
      track.genre?.name ||
      track.genre ||
      "",

    explicit: Boolean(
      track.isExplicit ||
        track.explicit
    ),

    isFeatured: Boolean(
      track.isFeatured ||
        track.featured
    ),

    playCount: Number(
      track.playCount || 0
    ),

    useCount: Number(
      track.useCount || 0
    ),
  };
}

function extractTracks(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.tracks)) {
    return data.tracks;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

async function searchTracks({
  query = "",
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(
    Number(page) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 20,
      1
    ),
    50
  );

  const offset =
    (safePage - 1) * safeLimit;

  const params =
    new URLSearchParams();

  const normalizedQuery =
    String(query || "").trim();

  if (normalizedQuery) {
    params.set(
      "term",
      normalizedQuery
    );
  }

  params.set(
    "limit",
    String(safeLimit)
  );

  params.set(
    "offset",
    String(offset)
  );

  params.set(
    "sort",
    "best-match"
  );

  params.set(
    "order",
    "asc"
  );

  params.set(
    "includeExplicit",
    "false"
  );

  const data =
    await epidemicRequest(
      `/v0/tracks/search?${params.toString()}`
    );

  const rawTracks =
    extractTracks(data);

  const tracks =
    rawTracks
      .map(normalizeTrack)
      .filter(Boolean);

  const pagination =
    data?.pagination || {};

  const total = Number(
    pagination.total ??
      data?.total ??
      tracks.length
  );

  console.log(
    "[MUSIC SEARCH RESULT]",
    {
      query: normalizedQuery,
      page: safePage,
      limit: safeLimit,
      received: rawTracks.length,
      normalized: tracks.length,
      total,
    }
  );

  return {
    tracks,
    page: safePage,
    limit: safeLimit,
    total,
    hasMore:
      tracks.length === safeLimit,
  };
}

async function getFeaturedTracks(limit = 20) {
  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 20,
      1
    ),
    50
  );

  const params =
    new URLSearchParams();

  params.set(
    "limit",
    String(safeLimit)
  );

  params.set(
    "offset",
    "0"
  );

  params.set(
    "includeExplicit",
    "false"
  );

  const data =
    await epidemicRequest(
      `/v0/tracks/search?${params.toString()}`
    );

  const rawTracks =
    extractTracks(data);

  const tracks =
    rawTracks
      .map(normalizeTrack)
      .filter(Boolean);

  console.log(
    "[MUSIC FEATURED RESULT]",
    {
      received: rawTracks.length,
      normalized: tracks.length,
      withAudioUrl: tracks.filter(
        (track) => Boolean(track.audioUrl)
      ).length,
    }
  );

  return tracks;
}

async function getPopularTracks(limit = 20) {
  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 20,
      1
    ),
    50
  );

  const params =
    new URLSearchParams();

  params.set(
    "limit",
    String(safeLimit)
  );

  params.set(
    "offset",
    "0"
  );

  params.set(
    "includeExplicit",
    "false"
  );

  const data =
    await epidemicRequest(
      `/v0/tracks/search?${params.toString()}`
    );

  const rawTracks =
    extractTracks(data);

  const tracks =
    rawTracks
      .map(normalizeTrack)
      .filter(Boolean);

  console.log(
    "[MUSIC POPULAR RESULT]",
    {
      received: rawTracks.length,
      normalized: tracks.length,
      withAudioUrl: tracks.filter(
        (track) => Boolean(track.audioUrl)
      ).length,
    }
  );

  return tracks;
}

async function getTrackById(providerTrackId) {
  if (!providerTrackId) {
    return null;
  }

  const params =
    new URLSearchParams();

  params.set(
    "trackId",
    providerTrackId
  );

  const data =
    await epidemicRequest(
      `/v0/tracks?${params.toString()}`
    );

  const tracks =
    extractTracks(data);

  return normalizeTrack(
    tracks[0]
  );
}

/*
 * Returns the provider's HLS preview information.
 *
 * The controller exposes this through:
 *
 * GET /api/music/:id/preview
 */
async function getTrackPreview(providerTrackId) {
  if (!providerTrackId) {
    const error = new Error(
      "Track ID is required"
    );

    error.status = 400;

    throw error;
  }

  const result =
    await epidemicRequest(
      `/v0/tracks/${encodeURIComponent(
        providerTrackId
      )}/hls`
    );

  console.log(
    "[MUSIC PREVIEW RESULT]",
    {
      trackId: providerTrackId,
      type: Array.isArray(result)
        ? "array"
        : typeof result,
      keys:
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
          ? Object.keys(result)
          : [],
    }
  );

  return result;
}

async function getTrackDownload(
  providerTrackId,
  quality = "normal"
) {
  if (!providerTrackId) {
    const error = new Error(
      "Track ID is required"
    );

    error.status = 400;

    throw error;
  }

  const params =
    new URLSearchParams();

  params.set(
    "format",
    "mp3"
  );

  params.set(
    "quality",
    quality === "high"
      ? "high"
      : "normal"
  );

  return epidemicRequest(
    `/v0/tracks/${encodeURIComponent(
      providerTrackId
    )}/download?${params.toString()}`
  );
}

async function createTrackVersion(
  providerTrackId,
  durationMs
) {
  if (!providerTrackId) {
    const error = new Error(
      "Track ID is required"
    );

    error.status = 400;

    throw error;
  }

  return epidemicRequest(
    "/v0/tracks/versions",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        trackId:
          providerTrackId,

        durationMs:
          Number(durationMs),
      }),
    }
  );
}

async function getTrackVersion(jobId) {
  if (!jobId) {
    const error = new Error(
      "Job ID is required"
    );

    error.status = 400;

    throw error;
  }

  return epidemicRequest(
    `/v0/tracks/versions/${encodeURIComponent(
      jobId
    )}`
  );
}

async function incrementPlayCount() {
  /*
   * Currently handled by provider/analytics.
   * Keep endpoint functional without failing the client.
   */
  return;
}

async function incrementUseCount() {
  /*
   * Currently handled by provider/analytics.
   * Keep endpoint functional without failing the client.
   */
  return;
}

module.exports = {
  normalizeTrack,
  searchTracks,
  getFeaturedTracks,
  getPopularTracks,
  getTrackById,
  getTrackPreview,
  getTrackDownload,
  createTrackVersion,
  getTrackVersion,
  incrementPlayCount,
  incrementUseCount,
};