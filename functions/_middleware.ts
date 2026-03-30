export const onRequest: PagesFunction = async (context) => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
    `script-src-elem 'self' 'nonce-${nonce}' https://stats.origuchi.qzz.io https://static.cloudflareinsights.com; ` +
    `connect-src 'self' https://stats.origuchi.qzz.io https://cloudflareinsights.com; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' data: https:; ` +
    `media-src 'self' https:;` +
    `frame-src 'none';` +
    `font-src 'self'; ` +
    `object-src 'none'; ` +
    `base-uri 'none'; ` +
    `form-action 'none'; ` +
    `frame-ancestors 'none'; ` +
    `upgrade-insecure-requests;`
  );
  return response;
};
