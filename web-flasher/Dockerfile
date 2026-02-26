FROM caddy:alpine
COPY . /srv/
EXPOSE 80
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
