# Self Hosted Radio

This project is a docker compose setup to have a self hosted radio working 24/7 on your server.

To start create a .env file with the passwords and the port (default 1970), and put your tracks in ./tracks folder, run docker compose up -d and enjoy your radio!

We use icecast to host the radio, and liquidsoap to handle the scheduling.

A simple custom dashboard is served by Icecast itself at the root URL (e.g. `http://localhost:1970/`). It shows the current track, listener count and stream info, and lets you play the radio right from the browser.

Liquidsoap is configured to never play the same artist twice in a row and exclude tracks that are shorter than 1 minute, or longer than 5 minutes.
