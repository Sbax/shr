# Self Hosted Radio

A Docker Compose setup that runs your own internet radio station 24/7. Drop your
music into a folder, start the stack, and stream it to anyone with a browser.

- **Icecast** hosts the stream and serves a small web dashboard.
- **Liquidsoap** shuffles your tracks and pushes an endless MP3 stream to Icecast.

## Features

- 24/7 continuous playback from a local folder of tracks.
- Randomized playlist that reloads automatically when you add or remove files.
- Built-in web dashboard with a player, live "now playing" info and listener count.
- Fully configurable through environment variables.
- Runs anywhere Docker does — no external services required.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose.
- A folder of audio files (MP3 works out of the box).

## Quick start

1. Add your music files to the `tracks/` folder.

2. Create a `.env` file in the project root with at least the source password
   (used by Liquidsoap to connect to Icecast):

   ```dotenv
   RADIO_PORT=1970
   ICECAST_SOURCE_PASSWORD=change-me
   ICECAST_ADMIN_PASSWORD=change-me
   ICECAST_PASSWORD=change-me
   ICECAST_RELAY_PASSWORD=change-me
   ```

3. Start the stack:

   ```bash
   docker compose up -d
   ```

4. Open the dashboard at [http://localhost:1970/](http://localhost:1970/) and
   press play. The raw stream is available at
   [http://localhost:1970/radio.mp3](http://localhost:1970/radio.mp3) for any
   media player (VLC, mobile apps, etc.).

## Configuration

All configuration is done through environment variables in your `.env` file.

| Variable                  | Default                              | Description                                             |
| ------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `RADIO_PORT`              | `1970`                               | Host port the radio is exposed on.                      |
| `ICECAST_SOURCE_PASSWORD` | —                                    | Password Liquidsoap uses to feed the stream to Icecast. |
| `ICECAST_ADMIN_PASSWORD`  | —                                    | Password for the Icecast admin interface.               |
| `ICECAST_PASSWORD`        | —                                    | Icecast listener/general password.                      |
| `ICECAST_RELAY_PASSWORD`  | —                                    | Password for relaying the stream.                       |
| `ICECAST_HOSTNAME`        | `localhost`                          | Public hostname advertised by Icecast.                  |
| `RADIO_NAME`              | `Self Hosted Radio`                  | Station name shown on the dashboard.                    |
| `RADIO_DESCRIPTION`       | `A self hosted radio, running 24/7.` | Station description.                                    |
| `RADIO_GENRE`             | `Various`                            | Station genre.                                          |

## Adding and updating tracks

Place your audio files in the `tracks/` folder. Liquidsoap watches this folder
and reloads the playlist automatically, so you can add or remove tracks without
restarting the stack.

## How it works

- `liquidsoap/radio.liq` builds a randomized, always-on playlist from `/tracks`
  and streams it to the Icecast container as MP3 at 128 kbps on the mount
  `/radio.mp3`.
- `icecast/icecast.xml` configures Icecast and serves the custom dashboard at the
  root URL instead of the default status page.
- `dashboard/` contains the web player (`index.html` and `style.css`) that Icecast
  serves.

## Common commands

```bash
# Start in the background
docker compose up -d

# Follow the logs
docker compose logs -f

# Stop everything
docker compose down
```
