#!/usr/bin/env liquidsoap

# ---------------------------------------------------------------------------
# Self Hosted Radio - Liquidsoap script
#
# Plays a random track from /tracks (mounted from ./tracks) and streams it to
# the Icecast container.
# ---------------------------------------------------------------------------

# Log to stdout so `docker compose logs` shows what is happening.
log.stdout := true
log.level := 3

# Play every file in /tracks in a random order, looping forever.
radio = playlist(mode="randomize", reload_mode="watch", "/tracks")

# Keep the source infallible so Icecast never gets disconnected.
radio = mksafe(radio)

# --- Output ----------------------------------------------------------------
output.icecast(
  %mp3(bitrate=128),
  host="icecast",
  port=8000,
  password=environment.get("ICECAST_SOURCE_PASSWORD"),
  mount="/radio.mp3",
  name=environment.get(default="Self Hosted Radio", "RADIO_NAME"),
  description=
    environment.get(default="A self hosted radio, running 24/7.", "RADIO_DESCRIPTION"),
  genre=environment.get(default="Various", "RADIO_GENRE"),
  radio
)
