// Live usage fetching is not implemented: provider usage endpoints differ too
// much for one generic call. This used to return random mock numbers, which
// would have replaced the real figures in /usage.json whenever it ran (it only
// never did because a CommonJS require() crashed it). Returning 501 keeps the
// client on its /usage.json fallback until real per-provider logic exists.
export const handler = async () => {
  return {
    statusCode: 501,
    body: JSON.stringify({
      error: 'Live usage fetching is not implemented; the app falls back to /usage.json.',
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
};
