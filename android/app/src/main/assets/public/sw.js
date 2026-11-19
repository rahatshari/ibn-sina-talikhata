/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "fbae01b63d32cd2df6d71c19f9e6bc82"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d4bc140e9f380a1d8beaf305d3f98bd7"
  }, {
    "url": "pwa-192x192.png",
    "revision": "543f12481241c59b7aaaadd54a70c697"
  }, {
    "url": "index.html",
    "revision": "24a5cd866c0a55095e6e876fc0b075a0"
  }, {
    "url": "icon.svg",
    "revision": "c0d4c426715e4645b81e0f85c5b3891e"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "bb892613360c6976b3529184b82ae508"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-Cn2PyFL8.js",
    "revision": null
  }, {
    "url": "assets/index-COBpbcVn.css",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-19-09-22-09-22_40deb401b9ffe8e1df2f1cc5ba480b12_70ae9f95.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-19-08-54-32-21_40deb401b9ffe8e1df2f1cc5ba480b12_f0837ec4.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-19-08-25-38-69_40deb401b9ffe8e1df2f1cc5ba480b12_588add6d.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-19-08-20-32-78_40deb401b9ffe8e1df2f1cc5ba480b12_9970a706.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG-20261118-WA0000_c735ac99.jpg",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "bb892613360c6976b3529184b82ae508"
  }, {
    "url": "icon.svg",
    "revision": "c0d4c426715e4645b81e0f85c5b3891e"
  }, {
    "url": "pwa-192x192.png",
    "revision": "543f12481241c59b7aaaadd54a70c697"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d4bc140e9f380a1d8beaf305d3f98bd7"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "fbae01b63d32cd2df6d71c19f9e6bc82"
  }, {
    "url": "manifest.webmanifest",
    "revision": "ac07ff24fe664e0bb799389218b1aba0"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
