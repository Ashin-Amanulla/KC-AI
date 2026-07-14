export function parsePagination(query = {}, defaultPageSize) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    10_000,
    Math.max(1, parseInt(query.pageSize, 10) || defaultPageSize)
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

export function paginationMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 1,
  };
}
