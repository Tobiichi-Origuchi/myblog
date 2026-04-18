export const onRequest: PagesFunction = async (context: { next: () => any; }) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'self' 'nonce-${nonce}' https://giscus.app https://static.cloudflareinsights.com; ` +
    `connect-src 'self' https://giscus.app https://cloudflareinsights.com; ` +
    `style-src 'self' 'unsafe-inline' https://giscus.app; ` +
    `img-src 'self' data: https:; ` +
    `media-src 'self' https:; ` +
    `frame-src 'self' https://giscus.app https://challenges.cloudflare.com; ` +
    `font-src 'self'; ` +
    `object-src 'none'; ` +
    `base-uri 'none'; ` +
    `form-action 'none'; ` +
    `frame-ancestors 'none'; ` +
    `upgrade-insecure-requests;`
  );
  return newResponse;
};
