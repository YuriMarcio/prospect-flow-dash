FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# O root do monorepo declara "puppeteer" como dependência (não usado por apps/api,
# que roda tudo via Playwright), e o instalador dele tenta baixar um Chrome próprio
# que falha nesta imagem — pulamos esse download, o Chromium do Playwright já basta.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --workspace=api

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3333

CMD ["npm", "run", "start"]
