const BASE_URL =
  process.env.EPIDEMIC_SOUND_API_URL ||
  "https://partner-content-api.epidemicsound.com";

const API_KEY =
  process.env.EPIDEMIC_SOUND_API_KEY;

function assertConfigured() {
  if (!API_KEY) {
    throw new Error(
      "EPIDEMIC_SOUND_API_KEY is not configured"
    );
  }
}

async function epidemicRequest(path, options = {}) {
  assertConfigured();

  const response = await fetch(
    `${BASE_URL}${path}`,
    {
      ...options,

      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`,
        ...(options.headers || {}),
      },
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.error(
      "[EPIDEMIC]",
      response.status,
      data
    );

    const error = new Error(
      data?.message ||
        `Epidemic API error ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function normalizeTrack(track) {
  if (!track) {
    return null;
  }

  return {
    id:
      track.id ||
      track.trackId ||
      "",

    title:
      track.title ||
      track.name ||
      "",

    artist:
      track.artist?.name ||
      track.artist ||
      track.artists?.[0]?.name ||
      "",

    album:
      track.album?.name ||
      track.album ||
      "",

    artworkUrl:
      track.coverArt?.url ||
      track.cover?.url ||
      track.image?.url ||
      track.imageUrl ||
      "",

    audioUrl:
      "",

    durationMs:
      Number(
        track.durationMs ||
        (track.duration
          ? Number(track.duration) * 1000
          : 0)
      ),

    provider:
      "epidemic",

    providerTrackId:
      track.id ||
      track.trackId ||
      "",

    genre:
      track.genre?.name ||
      track.genre ||
      "",

    explicit:
      Boolean(
        track.isExplicit ||
        track.explicit
      ),

    isFeatured:
      false,

    playCount:
      Number(track.playCount || 0),

    useCount:
      Number(track.useCount || 0),
  };
}

async function searchTracks({
  query = "",
  page = 1,
  limit = 20,
}) {
  const safePage = Math.max(
    Number(page) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    50
  );

  const offset =
    (safePage - 1) * safeLimit;

  const params = new URLSearchParams();

  if (query) {
    params.set(
      "term",
      String(query).trim()
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
    Array.isArray(data?.tracks)
      ? data.tracks
      : [];

  const tracks =
    rawTracks
      .map(normalizeTrack)
      .filter(Boolean);

  const pagination =
    data?.pagination || {};

  const total =
    Number(
      pagination.total ??
      data?.total ??
      tracks.length
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

async function getFeaturedTracks(
  limit = 20
) {
  const result =
    await searchTracks({
      query: "",
      page: 1,
      limit,
    });

  return result.tracks;
}

async function getPopularTracks(
  limit = 20
) {
  const result =
    await searchTracks({
      query: "",
      page: 1,
      limit,
    });

  return result.tracks;
}

async function getTrackById(
  providerTrackId
) {
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
    Array.isArray(data?.tracks)
      ? data.tracks
      : [];

  return normalizeTrack(
    tracks[0]
  );
}

async function getTrackPreview(
  providerTrackId
) {
  if (!providerTrackId) {
    throw new Error(
      "Track ID is required"
    );
  }

  return epidemicRequest(
    `/v0/tracks/${encodeURIComponent(
      providerTrackId
    )}/hls`
  );
}

async function getTrackDownload(
  providerTrackId,
  quality = "normal"
) {
  if (!providerTrackId) {
    throw new Error(
      "Track ID is required"
    );
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
    throw new Error(
      "Track ID is required"
    );
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

async function getTrackVersion(
  jobId
) {
  if (!jobId) {
    throw new Error(
      "Job ID is required"
    );
  }

  return epidemicRequest(
    `/v0/tracks/versions/${encodeURIComponent(
      jobId
    )}`
  );
}

async function incrementPlayCount() {
  return;
}

async function incrementUseCount() {
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