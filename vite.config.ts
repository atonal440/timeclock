/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

// Build stamp shown in the Projects tab footer, e.g. "a1b2c3d main · 2026-09-24 14:05Z".
// CI passes BUILD_SHA/BUILD_REF because PR checkouts are detached merge commits.
const sha = (process.env.BUILD_SHA || git('rev-parse HEAD')).slice(0, 7) || 'unknown'
const ref = process.env.BUILD_REF || git('rev-parse --abbrev-ref HEAD')
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z'
const appVersion = [sha, ref && ref !== 'HEAD' ? ref : '', '·', builtAt].filter(Boolean).join(' ')

// PR preview builds (PREVIEW_BUILD=1) skip the service worker: previews live
// under the live app's origin and shouldn't install or cache anything there.
const isPreviewBuild = process.env.PREVIEW_BUILD === '1'

// https://vite.dev/config/
export default defineConfig({
  // Use relative base for GitHub Pages compatibility
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [
    react(),
    VitePWA({
      disable: isPreviewBuild,
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-192.png',
        'icon-maskable-512.png'
      ],
      manifest: {
        name: "TimeClock",
        short_name: "TimeClock",
        description: "hledger time tracking",
        theme_color: "#080b12",
        background_color: "#080b12",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        globIgnores: ['**/index.html', 'pr-preview/**'],
        // PR previews under /pr-preview/ are separate apps; leave them alone.
        navigateFallbackDenylist: [/\/pr-preview\//],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => !url.pathname.includes('/pr-preview/') &&
              (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html')),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 5,
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*', 'tests/**']
  }
})
