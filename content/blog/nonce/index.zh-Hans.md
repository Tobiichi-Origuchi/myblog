+++
authors = ["Origuchi"]
title = "The CSP nonce Guide"
description = "Use a CSP nonce to allow the loading and execution of a script tag when a Content-Security-Policy is enabled."
date = 2026-04-09
updated = 2026-04-18
[taxonomies]
tags = ["CSP", "XSS", "Cloudflare", "JavaScript"]
+++

## CSP

CSP 的主要目的是减少 XSS 攻击，确保仅执行从白名单域获取到的脚本文件，有关 CSP 是什么的介绍不是本文重点，详细介绍见 [mdn](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/CSP)

## 内联脚本

内联脚本就是直接写在 HTML 中的 Javascript 代码，例如：
```html
<script>
  alert("114514");
</script>
```
或者可以直接在页面中被执行的脚本，例如：
```html
<button onClick="alert('114514');">homo</button>
```
那么问题来了，为什么 CSP 的默认要禁用内联脚本？

请看下面的例子：
```html
<div id="114514"></div><script src="homo.js"></script>
```
```javascript
// homo.js
document.getElementById("114514").innerHTML = decodeURIComponent(window.location.hash.substring(1))
```
假设这个网页运行在 `http://[]/homo.html`，我只要构建一个这样的 url：`http://[]/homo.html#<img src=null onerrer="alert('114514')">`，并且诱导用户点击这个 url，网站就会赫然发出“114514”的很臭的警报，那很严重了

这意味着 `<img src=null onerrer="alert('114514')">` 这段用于执行内联代码的代码直接在开发者完全不知情的情况下被注入了用户浏览的网页的 DOM 树里

还有一种更防不胜防的情况，就是供应链攻击（而且貌似近些天供应链攻击事件已经是家常便饭了）

举个例子你的网页引入了一个某个第三方 CDN 提供商提供的 js，现在有人利用各种手段，将你使用的 js 替换成了以下的代码：
```javascript
const paragraph = document.createElement('script');
paragraph.textContent = 'alert(\'114514\')';
document.getElementById('114514').appendChild(paragraph);
```
瞬间，那个熟悉的数字又出现在了警报中

事实上我们不难发现，如果允许内联代码可以被执行，就意味着任何的 Javascript 代码都有可能被执行，那你的 CSP 就完全失去了原本的防护的意义

简而言之，就是绝对不要在 `script-src` 开 `unsafe-inline`，这玩意都把 'unsafe' 写的那么明显了，就是不希望你启用它

## 对策

那么有人要说了，如果硬要写内联代码怎么办呢，我的评价是除非某些特殊情况下（我开发经验少，确实没遇到过这种情况），能不写就不写

对策当然是有的，一种是 hash，一种是这篇文章主要介绍的 nonce

### hash

这个方法很简单但也很安全，就是在你的 CSP 中写明可以被执行的内联代码的 hash 值就行了，例如：
```http
Content-Security-Policy: script-src 'self' 'sha256-hashOfYourScript'
```
但是这个方法有个局限性，就是你这段内联代码必须是固定不变的，如果要更改就需要你重新计算 hash 并更新 CSP 设置

### nonce

nonce 是什么？直译是表示“一次性的”

他事实上就是一个标记，给你的一段内联代码打上这个标记，比如：
```html
<script nonce="nonce-rAnd0m">
  alert("114514");
</script>
```
然后只需要在 CSP 中声明有这个标记的代码允许执行
```http
Content-Security-Policy: script-src 'self' 'nonce-rAnd0m'
```
然后就完成了，原理很简单

但是问题来了，假设我设定的这个标记被攻击者获取到，并且给他的恶臭代码打上了呢？

这时候 nonce 为什么叫 nonce 的意义就出现了，这个标记必须是一次性的，用完就被弃用，下次再次使用时必须重新生成一个新的，这样就完全避免了上面说到的重放攻击

那我们的目标就很明确了，我们现在需要在用户每次访问的时候都为用户生成一个完全随机的，并且足够随机以至于不能在生成前被猜到的数，将这个随机数为需要允许的内联代码打上，再修改 CSP 的响应头来允许有这个随机数标签的内联代码被执行

现在以 cloudflare 托管的静态页面为例，简单演示一下实现的方法

首先要明白，静态页面本身是绝对不可能做到上面说的这个操作的，所以必须使用一些动态的功能，例如 cloudflare 的 workers 功能

但是相对于 workers ，有另外一个功能更加适配这个场景，那就是 Page Functions 的功能，具体可以阅读 <https://developers.cloudflare.com/pages/functions/>

首先在项目的根目录创建 Page Functions 的入口
```bash
mkdir -p functions/_middleware.ts
```
这是一个中间件，会匹配同一 `/functions` 目录（包括子目录）中任何 Page Functions 的请求运行，我们需求的功能很简单，所以只需要这一个文件就 OK 了

接下来写入函数内容：
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
这是一个简单的演示函数，具体 CSP 如何配置自己写

简单概述一下这个函数做了什么：
1. 获取响应
2. 获取响应头
3. 判断是否是 html 文件，若不是，直接返回
4. 若是 html，用 `randomUUID()` 生成随机数
5. 修改响应头并返回新响应

那么问题又来了，如何给内联代码写入 nonce 值呢？

的确这是个问题，如果是你自己写在页面中的内联代码，cloudflare 自然是不会那么智能地帮你扫描出有内联代码的地方并帮你写入 nonce 值的

所以这种情况下可以使用 HTMLRewriter 来给响应中的所有 script 标签动态注入 nonce 值，可以参考这个：<https://developers.cloudflare.com/workers/examples/spa-shell/#add-csp-nonces>
```typescript
const newResponse = new HTMLRewriter()
  .on("script", {
    element(el) {
      el.setAttribute("nonce", nonce);
    },
  })
  .transform(response);
```
但是，事实上我主要想说的是另外一种情况，同时也是之所以写本文的目的，就是应对 cloudflare 的 JavaScript Detections 功能动态注入的内联代码会被 CSP 阻断的问题

根据文档：<https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/>

> If your CSP uses a `nonce` for script tags, Cloudflare will add these nonces to the scripts it injects by parsing your CSP response header.

这段话说明了一个非常好的消息，就是只要确保你的响应头的 CSP 中包含了 nonce 值，cloudflare 就会帮你自动把这段 nonce 值赋予给它给你注入的内联代码

也就是说，我们上面创建的 `functions/_middleware.ts` 已经足够了，因为他的功能不就是重新生成一个新的包含了有 nonce 值的 CSP 的响应

## 优化

或许本文到此应该结束了，但是如果你确实按照我的方法进行过实操，你就会发现你的 cloudflare 的 workers 计算额度正在疯狂燃烧！

为什么？

观察这里：
```typescript
if (!contentType.includes('text/html')) {
  return response;
}
```
这段代码的功能很好啊，目的是过滤出需要注入 nonce 值的 html 文件，其他像图片，css等文件根本不需要注入，所以就用一个条件判断跳过了，看似是大幅优化了 cloudflare 的 workers 的计算消耗

然而事实却是，每当这段代码执行了一次 if 判断，就是视作一次 workers 计算，看似省了计算开销，其实完全没有省

假设你某天兴致大发，拍了 10 张优美的风景照并全部放进了一个博客页面中，每当你的访客打开一次这个博客页，你的 workers 计算额度瞬间至少消耗了 12 次（html 页面一次，css 一次，10 张图片 10 次）！

那咋办呢？

办法总比困难多，cloudflare 为你准备了一个功能：<https://developers.cloudflare.com/pages/functions/routing/#functions-invocation-routes>

> On a purely static project, Pages offers unlimited free requests. However, once you add Functions on a Pages project, all requests by default will invoke your Function. To continue receiving unlimited free static requests, exclude your project's static routes by creating a _routes.json file. This file will be automatically generated if a functions directory is detected in your project when you publish your project with Pages CI or Wrangler.

只要你最终构建出的静态页面的根目录存在 `_routes.json` 这个文件，cloudflare 就会按照其中写的规则来决定哪些文件需要执行 function，哪些文件不需要

举个简单的书写示例，以 zola 为例，他的 `static` 目录的文件最终会完整地被复制到构建产物的根目录，所以先在 `static` 目录创建 `_routes.json`
```bash
mkdir -p static/_routes.json
```
然后写入一个简单的示例内容：
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
这样，Page Function 执行的时候就会把你的 png 图片和 css 样式文件排除在外

当然，规则是有一定的限制的

> - You must have at least one include rule.
> - You may have no more than 100 include/exclude rules combined.
> - Each rule may have no more than 100 characters.

100 条规则一般情况下不容易超，但是一方面也是为了简洁，尽量使用通配符来书写规则

## 总结

懒得写
