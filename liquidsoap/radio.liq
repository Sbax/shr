#!/usr/bin/env liquidsoap

# ---------------------------------------------------------------------------
# Self Hosted Radio - Liquidsoap scheduling script
#
# - Plays every track found in /tracks (mounted from ./tracks).
# - Never plays the same artist twice in a row.
# - Excludes tracks shorter than 1 minute or longer than 5 minutes.
# - Streams to the Icecast container on the "icecast" host.
# ---------------------------------------------------------------------------

# Log to stdout so `docker compose logs` shows what is happening.
log.stdout := true
log.level := 3

# --- Configuration ---------------------------------------------------------
tracks_dir = "/tracks"
min_duration = 60.0    # 1 minute
max_duration = 300.0   # 5 minutes

# Remember the artist of the last track we played so we never play the same
# artist twice in a row.
last_artist = ref("")

# How many random candidates to inspect per selection. Resolving a request
# reads the track's metadata (including its duration), so with a large library
# we only want to pay that cost for a handful of tracks instead of the whole
# collection.
max_candidates = 5

# --- Track selection -------------------------------------------------------
# Returns the next request as a (possibly empty) list, as expected by
# request.dynamic.list. We pick a random track whose duration is within the
# allowed range and whose artist differs from the previously played one.
def next_track() =
  # file.ls with recursive=true also returns the sub-directories themselves.
  # Keep only regular files so Liquidsoap never tries to resolve a directory.
  all_entries = file.ls(tracks_dir, absolute=true, recursive=true)
  files_only = list.filter(fun (p) -> not file.is_directory(p), all_entries)
  # Only inspect a small random sample so we never resolve (and read the
  # duration of) the entire library before starting playback.
  candidates = list.shuffle(files_only)
  candidates = list.prefix(max_candidates, candidates)

  def rec pick(files) =
    if files == [] then
      # Nothing matched (e.g. a single artist library): clear the constraint
      # so the next call can succeed instead of starving the stream.
      last_artist := ""
      []
    else
      path = list.hd(default="", files)
      rest = list.tl(files)
      r = request.create(path)
      if request.resolve(r) then
        m = request.metadata(r)
        artist = m["artist"]
        duration = float_of_string(default=0.0, m["duration"])
        if
          duration >= min_duration
        and
          duration <= max_duration
        and
          (artist == "" or artist != last_artist())
        then
          last_artist := artist
          [r]
        else
          request.destroy(r)
          pick(rest)
        end
      else
        request.destroy(r)
        pick(rest)
      end
    end
  end

  pick(candidates)
end

radio = request.dynamic.list(next_track)

# Keep the source infallible so Icecast never gets disconnected.
radio = mksafe(radio)

# --- Output ----------------------------------------------------------------
radio_name = environment.get(default="Self Hosted Radio", "RADIO_NAME")
radio_description =
  environment.get(default="A self hosted radio, running 24/7.", "RADIO_DESCRIPTION")
radio_genre = environment.get(default="Various", "RADIO_GENRE")

output.icecast(
  %mp3(bitrate=128),
  host="icecast",
  port=8000,
  password=environment.get("ICECAST_SOURCE_PASSWORD"),
  mount="/radio.mp3",
  name=radio_name,
  description=radio_description,
  genre=radio_genre,
  radio
)
