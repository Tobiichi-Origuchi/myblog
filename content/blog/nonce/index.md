+++
authors = ["Origuchi"]
title = "The CSP nonce Guide"
description = "Use a CSP nonce to allow the loading and execution of a script tag when a Content-Security-Policy is enabled."
date = 2026-04-18
[taxonomies]
tags = ["CSP", "XSS", "Cloudflare", "JavaScript"]
+++

> [!NOTE]
> This page was translated with the assistance of Gemini; the [Chinese version](https://blog.origuchi.uk/zh-Hans/blog/nonce/) shall prevail.

## CSP

The main purpose of CSP is to reduce XSS attacks and ensure that only script files fetched from whitelisted domains are executed. An introduction to what CSP is is not the focus of this article; for detailed information, refer to [mdn](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/CSP).

## Inline Scripts

Inline scripts are Javascript codes written directly in HTML, for example:
```html
<script>
  alert("114514");
</script>
```
Or scripts that can be executed directly in the page, for example:
```html
<button onClick="alert('114514');">homo</button>
```
So the question arises, why does CSP disable inline scripts by default?

Please look at the following example:
```html
<div id="114514"></div><script src="homo.js"></script>
```
```javascript
// homo.js
document.getElementById("114514").innerHTML = decodeURIComponent(window.location.hash.substring(1))
```
Assume this webpage runs at `http://[]/homo.html`. I just need to construct a url like this: `http://[]/homo.html#<img src=null onerrer="alert('114514')">`, and induce the user to click this url. The website will impressively issue a very stinky "114514" alert. That's very serious.

This means that the code `<img src=null onerrer="alert('114514')">` used to execute inline script is injected directly into the DOM tree of the webpage browsed by the user without the developer knowing anything at all.

There is also a situation that is even harder to guard against, which is a supply chain attack (and it seems supply chain attack incidents have become commonplace these days).

For example, your webpage imports a js provided by a third-party CDN provider. Now someone uses various means to replace the js you use with the following code:
```javascript
const paragraph = document.createElement('script');
paragraph.textContent = 'alert(\'114514\')';
document.getElementById('114514').appendChild(paragraph);
```
Instantly, that familiar number appears in the alert again.

In fact, it is not difficult to find that if inline script is allowed to be executed, it means that any Javascript code may be executed, and your CSP completely loses its original protective meaning.

In short, absolutely do not turn on `unsafe-inline` in `script-src`. This thing has 'unsafe' written so obviously, it just means it doesn't want you to enable it.

## Countermeasures

Then someone might say, what if I insist on writing inline script? My comment is that unless under certain special circumstances (I have little development experience and indeed haven't encountered this situation), don't write it if you can avoid it.

There are of course countermeasures, one is hash, and the other is nonce, which is what this article mainly introduces.

### hash

This method is very simple but also very safe. Just write the hash value of the inline script that is allowed to be executed in your CSP, for example:
```http
Content-Security-Policy: script-src 'self' 'sha256-hashOfYourScript'
```
But this method has a limitation, which is that your inline script must be fixed and unchanging. If you want to change it, you need to recalculate the hash and update the CSP settings.

### nonce

What is nonce? The literal translation means "one-time".

It is actually a tag. You tag a piece of your inline script with it, like:
```html
<script nonce="nonce-rAnd0m">
  alert("114514");
</script>
```
Then you just need to declare in the CSP that code with this tag is allowed to execute:
```http
Content-Security-Policy: script-src 'self' 'nonce-rAnd0m'
```
And then it's done, the principle is very simple.

But the problem comes, suppose this tag I set is obtained by an attacker, and they tag their stinky code with it?

At this time, the meaning of why a nonce is called a nonce appears. This tag must be one-time, discarded after use, and a new one must be generated the next time it is used again. This completely avoids the replay attack mentioned above.

Then our goal is very clear. We now need to generate a completely random number for the user every time they visit, which is random enough that it cannot be guessed before generation. Tag the allowed inline script with this random number, and then modify the CSP response header to allow inline script with this random number tag to be executed.

Now take a static page hosted by cloudflare as an example to briefly demonstrate the implementation method.

First of all, you must understand that the static page itself is absolutely impossible to achieve the operation mentioned above, so some dynamic functions must be used, such as cloudflare's workers function.

But compared to workers, there is another function that is more suitable for this scenario, which is the Page Functions function, you can read <https://developers.cloudflare.com/pages/functions/> for details.

First create the entry for Page Functions in the root directory of the project:
```bash
mkdir -p functions/_middleware.ts
```
This is a middleware that will match any Page Functions request running in the same `/functions` directory (including subdirectories). The function we need is very simple, so only this one file is OK.

Next, write the function content:
```typescript
export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${nonce}'`
  );
  return newResponse;
};
```
This is a simple demo function, you can write how to configure CSP yourself.

Briefly summarize what this function does:
1. Get the response
2. Get the response headers
3. Determine whether it is an html file; if not, return directly
4. If it is html, use `randomUUID()` to generate a random number
5. Modify the response header and return the new response

Then the question comes again, how to write the nonce value to the inline script?

Indeed, this is a problem. If it is the inline script you write on the page yourself, cloudflare naturally will not be so smart as to scan the places with inline script for you and write the nonce value for you.

So in this case, you can use HTMLRewriter to dynamically inject the nonce value into all script tags in the response. You can refer to this: <https://developers.cloudflare.com/workers/examples/spa-shell/#add-csp-nonces>
```typescript
const newResponse = new HTMLRewriter()
  .on("script", {
    element(el) {
      el.setAttribute("nonce", nonce);
    },
  })
  .transform(response);
```
However, in fact, what I mainly want to talk about is another situation, and also the reason for writing this article, which is to deal with the problem that the inline script dynamically injected by cloudflare's JavaScript Detections function will be blocked by CSP.

According to the documentation: <https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/>

> If your CSP uses a `nonce` for script tags, Cloudflare will add these nonces to the scripts it injects by parsing your CSP response header.

This passage illustrates very good news, which is that as long as you ensure that the CSP in your response header contains a nonce value, cloudflare will automatically assign this nonce value to the inline script it injects for you.

In other words, the `functions/_middleware.ts` we created above is already enough, because isn't its function exactly to regenerate a new response with a CSP containing a nonce value?

## Optimization

Perhaps this article should end here, but if you really followed my method in practice, you will find that your cloudflare workers calculation quota is burning crazily!

Why?

Observe here:
```typescript
if (!contentType.includes('text/html')) {
  return response;
}
```
The function of this code is very good, the purpose is to filter out the html files that need to inject the nonce value. Other files like pictures, css, etc. do not need to be injected at all, so an if condition is used to skip them. It seems to have significantly optimized the calculation overhead of cloudflare's workers.

However, the fact is that every time this code executes an if judgment, it is regarded as a workers calculation. It seems to save calculation overhead, but it actually doesn't save anything at all.

Suppose you are in a good mood one day, took 10 beautiful scenery photos and put them all in a blog page. Every time your visitor opens this blog page, your workers calculation quota is instantly consumed at least 12 times (once for the html page, once for css, 10 times for 10 pictures)!

So what to do?

There are always more solutions than difficulties, cloudflare has prepared a feature for you: <https://developers.cloudflare.com/pages/functions/routing/#functions-invocation-routes>

> On a purely static project, Pages offers unlimited free requests. However, once you add Functions on a Pages project, all requests by default will invoke your Function. To continue receiving unlimited free static requests, exclude your project's static routes by creating a _routes.json file. This file will be automatically generated if a functions directory is detected in your project when you publish your project with Pages CI or Wrangler.

As long as the `_routes.json` file exists in the root directory of your finally built static page, cloudflare will decide which files need to execute the function and which files do not according to the rules written in it.

To give a simple writing example, taking zola as an example, the files in its `static` directory will ultimately be completely copied to the root directory of the build product, so first create `_routes.json` in the `static` directory
```bash
mkdir -p static/_routes.json
```
Then write a simple example content:
```json
{
  "version": 1,
  "include": [
    "/*"
  ],
  "exclude": [
    "/*.png",
    "/*.css",
  ]
}
```
This way, when the Page Function is executed, your png pictures and css style files will be excluded.

Of course, the rules have certain limitations.

> - You must have at least one include rule.
> - You may have no more than 100 include/exclude rules combined.
> - Each rule may have no more than 100 characters.

100 rules are not easy to exceed under normal circumstances, but on the one hand, for the sake of simplicity, try to use wildcards to write rules.

## Conclusion

Too lazy to write
