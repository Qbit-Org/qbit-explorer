FROM rust:1.84-bookworm@sha256:738ae99a3d75623f41e6882566b4ef37e38a9840244a47efd4a0ca22e9628b88 AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build

RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSLo /tmp/nodesource-setup.sh https://deb.nodesource.com/setup_26.x && \
    echo "4b735bb6ffba89e2965fa4219ec24c598b19d7ca63796ff6afaa324583333384  /tmp/nodesource-setup.sh" | sha256sum -c - && \
    bash /tmp/nodesource-setup.sh && \
    rm -f /tmp/nodesource-setup.sh && \
    apt-get install -y nodejs=26.12.1-1nodesource1 build-essential python3 pkg-config && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

ENV PATH="/usr/local/cargo/bin:$PATH"

COPY --from=backend . .
COPY --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt
RUN npm install --omit=dev --omit=optional

WORKDIR /build
RUN npm run package

FROM rust:1.84-bookworm@sha256:738ae99a3d75623f41e6882566b4ef37e38a9840244a47efd4a0ca22e9628b88 AS runtime

RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSLo /tmp/nodesource-setup.sh https://deb.nodesource.com/setup_26.x && \
    echo "4b735bb6ffba89e2965fa4219ec24c598b19d7ca63796ff6afaa324583333384  /tmp/nodesource-setup.sh" | sha256sum -c - && \
    bash /tmp/nodesource-setup.sh && \
    rm -f /tmp/nodesource-setup.sh && \
    apt-get install -y nodejs=26.12.1-1nodesource1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/package ./package/
COPY --from=builder --chown=1000:1000 /build/GeoIP ./GeoIP/
COPY --from=builder --chown=1000:1000 /build/mempool-config.json /build/start.sh /build/wait-for-it.sh ./

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]
