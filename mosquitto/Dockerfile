FROM eclipse-mosquitto:2.0

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 1883
EXPOSE 8883

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
