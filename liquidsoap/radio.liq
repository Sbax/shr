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

# Remember the artist of the track that is currently playing so we can avoid
# playing the same artist twice in a row.
last_artist = ref("")

# Keep tracks that are between one and five minutes long and whose artist is
# different from the previously played one.
def valid_track(request) =
  file = request.filename(request)
  duration = request.duration(file)
  if duration < 60. or duration > 300. then
    log("Skipping #{file}: out of range (#{duration}s)")
    false
  else
    if request.resolve(request) then
      artist = request.metadata(request)["artist"]
      if artist != "" and artist == last_artist() then
        log("Skipping #{file}: same artist in a row (#{artist})")
        false
      else
        true
      end
    else
      true
    end
  end
end

# Play every file in /tracks in a random order, looping forever.
radio =
  playlist(
    mode="randomize", reload_mode="watch", check_next=valid_track, "/tracks"
  )

# Track the artist of the track that actually starts playing.
def on_meta(m) =
  last_artist := m["artist"]
end
radio.on_metadata(on_meta)

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
