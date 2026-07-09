FROM moul/icecast

# Ship a custom config (dashboard served at /) and the dashboard page itself.
COPY icecast/icecast.xml /etc/icecast2/icecast.xml
COPY dashboard/index.html /usr/share/icecast2/web/index.html
COPY dashboard/dashboard-resources /usr/share/icecast2/web/dashboard-resources
