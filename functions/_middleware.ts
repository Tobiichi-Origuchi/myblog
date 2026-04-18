export const onRequest: PagesFunction = async (context: { next: () => any; }) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const newResponse = new HTMLRewriter()
    .on("script", {
      element(el: HTMLElement) {
        el.setAttribute("nonce", nonce);
      },
    })
    .on("style", {
      element(el: HTMLElement) {
        el.setAttribute("nonce", nonce);
      },
    })
    .transform(response);
  newResponse.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'self' 'strict-dynamic' 'nonce-${nonce}'; ` +
    `connect-src 'self' https://giscus.app https://cloudflareinsights.com; ` +
    `style-src 'self' 'nonce-${nonce}'; ` +
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
