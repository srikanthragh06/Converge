#!/usr/bin/env bash
# Runs on the droplet, called over SSH by .github/workflows/deploy.yml after it
# has pushed a new server image and copied this repo's deploy files here.
#
# 1. Installs the nginx configs and reloads nginx — only if `nginx -t` passes,
#    otherwise the previous configs are put back and the deploy stops.
# 2. Rolls the 2 server instances onto the new image one at a time: server-1
#    first, and only once it's healthy, server-2. If server-1 never gets
#    healthy, it's put back on the previous image and the deploy stops, while
#    server-2 keeps serving the old version throughout.
# 3. Removes old server images, keeping the new and the previous one.
#
# Usage: remote-deploy.sh <docr-registry-name> <image-tag>
# Run from the deploy directory (the one holding docker-compose.prod.yml).
#
# Needs a sudo rule for exactly `nginx -t` and `nginx -s reload`, and
# /etc/nginx/sites-available/converge.conf and converge-test.conf created at
# droplet setup and owned by the deploy user: it can overwrite those two files
# but not create or delete files in that directory.

set -euo pipefail

REGISTRY="$1"
NEW_TAG="$2"
COMPOSE="docker compose -f docker-compose.prod.yml"
NGINX_SITES="/etc/nginx/sites-available"
# Backups of the live nginx configs, kept in the deploy directory because the
# deploy user can't create files in NGINX_SITES.
NGINX_BACKUP="nginx-previous"

# The tag deployed before this run, so a failed server-1 can be put back on it.
# Empty on the very first deploy, when .env doesn't exist yet.
PREVIOUS_TAG=""
if [ -f .env ]; then
    PREVIOUS_TAG=$(grep '^IMAGE_TAG=' .env | cut -d= -f2)
fi

# Writes the .env Compose reads for the image name (see docker-compose.prod.yml).
# @param $1 - the image tag to point both servers at
write_env() {
    printf 'DOCR_REGISTRY=%s\nIMAGE_TAG=%s\n' "$REGISTRY" "$1" > .env
}

# Waits for a server container's healthcheck to report healthy. Gives up after
# 180s, which covers the healthcheck's 30s start period plus its 12 retries.
# @param $1 - the Compose service name (server-1 or server-2)
# @returns 0 once healthy, 1 if it reports unhealthy or never gets healthy
wait_healthy() {
    local container
    container=$($COMPOSE ps -q "$1")

    for attempt in $(seq 1 36); do
        local status
        status=$(docker inspect -f '{{.State.Health.Status}}' "$container")

        if [ "$status" = "healthy" ]; then
            echo "$1 is healthy"
            return 0
        fi
        if [ "$status" = "unhealthy" ]; then
            echo "$1 is unhealthy"
            return 1
        fi

        sleep 5
    done

    echo "$1 did not become healthy in time"
    return 1
}

echo "==> Installing nginx configs"
mkdir -p "$NGINX_BACKUP"
# Only the test subdomains' config until the cutover: converge.conf names the
# real subdomains' certificates, which are issued on this droplet only after
# their DNS points here. At the cutover, switch both loops to converge.conf.
for conf in converge-test.conf; do
    # Keep the live copy so a config that fails `nginx -t` can be put back.
    cp "$NGINX_SITES/$conf" "$NGINX_BACKUP/$conf"
    cp "nginx/$conf" "$NGINX_SITES/$conf"
done

if ! sudo nginx -t; then
    echo "nginx -t failed — restoring the previous configs"
    for conf in converge-test.conf; do
        cp "$NGINX_BACKUP/$conf" "$NGINX_SITES/$conf"
    done
    exit 1
fi
sudo nginx -s reload

echo "==> Pulling image $NEW_TAG"
write_env "$NEW_TAG"
$COMPOSE pull server-1 server-2
# Starts Redis if it isn't running yet; a no-op otherwise.
$COMPOSE up -d redis

echo "==> Rolling server-1"
$COMPOSE up -d --no-deps server-1
if ! wait_healthy server-1; then
    if [ -n "$PREVIOUS_TAG" ]; then
        echo "Putting server-1 back on $PREVIOUS_TAG"
        write_env "$PREVIOUS_TAG"
        $COMPOSE up -d --no-deps server-1
    fi
    exit 1
fi

echo "==> Rolling server-2"
$COMPOSE up -d --no-deps server-2
if ! wait_healthy server-2; then
    # server-1 already serves the new version, so leave both on it and stop
    # here for a person to look at server-2.
    exit 1
fi

echo "==> Removing old server images"
for image in $(docker images --format '{{.Repository}}:{{.Tag}}' | grep '/converge-server:'); do
    tag="${image##*:}"
    if [ "$tag" != "$NEW_TAG" ] && [ "$tag" != "$PREVIOUS_TAG" ]; then
        # Cleanup only — a failure here mustn't fail a deploy that already succeeded.
        docker rmi "$image" || echo "Could not remove $image"
    fi
done

echo "==> Deployed $NEW_TAG"
