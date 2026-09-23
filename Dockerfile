# Build the Astro site, then run its Node server in a slim image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# PUBLIC_* values are baked into the pages at build time.
ARG SITE_URL=https://cudgs.org
ARG PUBLIC_GOOGLE_CALENDAR_ID=
ARG PUBLIC_GOOGLE_API_KEY=
ARG PUBLIC_UMAMI_SCRIPT=
ARG PUBLIC_UMAMI_WEBSITE_ID=
ENV SITE_URL=$SITE_URL \
    PUBLIC_GOOGLE_CALENDAR_ID=$PUBLIC_GOOGLE_CALENDAR_ID \
    PUBLIC_GOOGLE_API_KEY=$PUBLIC_GOOGLE_API_KEY \
    PUBLIC_UMAMI_SCRIPT=$PUBLIC_UMAMI_SCRIPT \
    PUBLIC_UMAMI_WEBSITE_ID=$PUBLIC_UMAMI_WEBSITE_ID
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4321
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:4321/ >/dev/null || exit 1
CMD ["node", "dist/server/entry.mjs"]
