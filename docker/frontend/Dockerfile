FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS builder

ARG commitHash
ENV DOCKER_COMMIT_HASH=${commitHash}
ENV CYPRESS_INSTALL_BINARY=0

WORKDIR /build
COPY . .
RUN apt-get update
RUN apt-get install -y build-essential rsync
RUN cp mempool-frontend-config.sample.json mempool-frontend-config.json
RUN npm install --omit=dev --omit=optional

# The build lists the mining pool logos through the GitHub API. The optional
# github_token build secret raises GitHub's rate limit for that; without it
# the calls go unauthenticated. The secret is mounted for this step only and
# isn't stored in the image.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null)" npm run build

FROM nginx:1.30.6-alpine@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311

WORKDIR /patch

COPY --from=builder /build/entrypoint.sh .
COPY --from=builder /build/wait-for .
COPY --from=builder /build/dist/mempool /var/www/mempool
COPY --from=builder /build/nginx.conf /etc/nginx/
COPY --from=builder /build/nginx-mempool.conf /etc/nginx/conf.d/

RUN chmod +x /patch/entrypoint.sh
RUN chmod +x /patch/wait-for

RUN chown -R 1000:1000 /patch && chmod -R 755 /patch && \
        chown -R 1000:1000 /var/cache/nginx && \
        chown -R 1000:1000 /var/log/nginx && \
        chown -R 1000:1000 /etc/nginx/nginx.conf && \
        chown -R 1000:1000 /etc/nginx/conf.d && \
        chown -R 1000:1000 /var/www/mempool

RUN touch /var/run/nginx.pid && \
        chown -R 1000:1000 /var/run/nginx.pid

USER 1000

ENTRYPOINT ["/patch/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
