[17:01:11.866] Running build in Washington, D.C., USA (East) – iad1
[17:01:11.961] Cloning github.com/dame-is/im.flushing (Branch: main, Commit: bbbd0ef)
[17:01:12.062] Previous build caches not available
[17:01:12.322] Cloning completed: 361.000ms
[17:01:12.636] Running "vercel build"
[17:01:13.034] Vercel CLI 41.2.2
[17:01:13.312] Installing dependencies...
[17:01:22.815] 
[17:01:22.815] added 41 packages in 9s
[17:01:22.816] 
[17:01:22.816] 4 packages are looking for funding
[17:01:22.816]   run `npm fund` for details
[17:01:22.864] Detected Next.js version: 14.2.24
[17:01:22.867] Running "npm run build"
[17:01:23.882] 
[17:01:23.882] > im-flushing@0.1.0 build
[17:01:23.882] > next build
[17:01:23.882] 
[17:01:24.450] Attention: Next.js now collects completely anonymous telemetry regarding usage.
[17:01:24.450] This information is used to shape Next.js' roadmap and prioritize features.
[17:01:24.450] You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
[17:01:24.450] https://nextjs.org/telemetry
[17:01:24.450] 
[17:01:24.507]   ▲ Next.js 14.2.24
[17:01:24.507] 
[17:01:24.579]    Creating an optimized production build ...
[17:01:34.117]  ✓ Compiled successfully
[17:01:34.118]    Linting and checking validity of types ...
[17:01:36.299]    Collecting page data ...
[17:01:37.136]    Generating static pages (0/7) ...
[17:01:37.345]    Generating static pages (1/7) 
[17:01:37.346]    Generating static pages (3/7) 
[17:01:37.520]  ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/auth/callback". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
[17:01:37.521]     at o (/vercel/path0/app/.next/server/chunks/819.js:1:10537)
[17:01:37.521]     at c (/vercel/path0/app/.next/server/chunks/819.js:1:21473)
[17:01:37.521]     at c (/vercel/path0/app/.next/server/app/auth/callback/page.js:1:2309)
[17:01:37.521]     at nj (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:46252)
[17:01:37.521]     at nM (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47572)
[17:01:37.521]     at nN (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:64547)
[17:01:37.521]     at nI (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47011)
[17:01:37.521]     at nM (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47718)
[17:01:37.521]     at nM (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:61547)
[17:01:37.521]     at nN (/vercel/path0/app/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:64547)
[17:01:37.521] 
[17:01:37.521] Error occurred prerendering page "/auth/callback". Read more: https://nextjs.org/docs/messages/prerender-error
[17:01:37.521] 
[17:01:37.522]    Generating static pages (5/7) 
[17:01:37.577]  ✓ Generating static pages (7/7)
[17:01:37.582] 
[17:01:37.586] > Export encountered errors on following paths:
[17:01:37.586] 	/auth/callback/page: /auth/callback
[17:01:37.608] Error: Command "npm run build" exited with 1
[17:01:37.827] 