# syntax=docker/dockerfile:1
# Web UI image: static files served by Nginx running as a non-root user (uid 101) on port 8080.
#
# Base image: the official nginx image, slim variant (no extra modules we don't use). It gets
# every nginx release within about a day. We used nginxinc/nginx-unprivileged before, but that
# image is rebuilt only once a week: in November 2026 it stayed on a vulnerable nginx for a
# week and Trivy blocked every pull request. The official image starts as root, so the RUN
# step below makes it run unprivileged with the same changes nginx-unprivileged makes.
FROM nginx:stable-alpine-slim

# Patch OS packages, then: no "user" directive (the master process is not root), PID file and
# temporary files in /tmp instead of root-owned paths.
RUN apk upgrade --no-cache \
    && sed -i '/user  nginx;/d' /etc/nginx/nginx.conf \
    && sed -i 's,\(/var\)\{0\,1\}/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf \
    && sed -i "/^http {/a \    proxy_temp_path /tmp/proxy_temp;\n    client_body_temp_path /tmp/client_temp;\n    fastcgi_temp_path /tmp/fastcgi_temp;\n    uwsgi_temp_path /tmp/uwsgi_temp;\n    scgi_temp_path /tmp/scgi_temp;\n" /etc/nginx/nginx.conf \
# the nginx user (uid 101) must own its cache directory and config
    && chown -R 101:0 /var/cache/nginx /etc/nginx \
    && chmod -R g+w /var/cache/nginx /etc/nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js style.css /usr/share/nginx/html/

USER 101
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/nginx-health || exit 1
