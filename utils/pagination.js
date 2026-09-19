const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function getPagination(
  req,
  options = {}
) {
  const {
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = MAX_LIMIT,
  } = options;

  const requestedPage = Number(
    req?.query?.page
  );

  const requestedLimit = Number(
    req?.query?.limit
  );

  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.floor(requestedPage))
    : DEFAULT_PAGE;

  const limit = Number.isFinite(requestedLimit)
    ? Math.min(
        maxLimit,
        Math.max(
          1,
          Math.floor(requestedLimit)
        )
      )
    : defaultLimit;

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function buildPaginationMeta({
  page,
  limit,
  total,
}) {
  const safeTotal = Math.max(
    0,
    Number(total) || 0
  );

  const totalPages =
    safeTotal === 0
      ? 0
      : Math.ceil(safeTotal / limit);

  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasMore:
      totalPages > 0 &&
      page < totalPages,
    hasPrevious:
      page > 1,
  };
}

function getPaginationQuery(
  page,
  limit
) {
  const safePage = Math.max(
    1,
    Number(page) || 1
  );

  const safeLimit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(limit) || DEFAULT_LIMIT)
  );

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getPagination,
  getPaginationQuery,
  buildPaginationMeta,
};