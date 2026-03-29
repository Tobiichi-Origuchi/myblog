export default {
  async fetch(request) {
    const response = await fetch(request);
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      return response;
    }
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const rewriter = new HTMLRewriter()
      .on('script', {
        element(element) {
          element.setAttribute('nonce', nonce);
        }
      });
    const csp = `
      font-src 'self';
      img-src 'self' https: data:;
      media-src 'self' https:;
      script-src 'self' 'nonce-${nonce}' static.cloudflareinsights.com stats.origuchi.qzz.io;
      style-src 'self' 'unsafe-inline';
      frame-src https://player.vimeo.com https://www.youtube-nocookie.com https://vmst.io;
      connect-src *.umami.dev cloud.umami.is;
      base-uri 'none';
      form-action 'none'
    `.trim().replace(/\s+/g, ' ');
    const newResponse = rewriter.transform(response);
    newResponse.headers.set('Content-Security-Policy', csp);
    return newResponse;
  }
};
