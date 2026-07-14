const player = document.getElementById("player");
const playBtn = document.getElementById("play-btn");
const muteBtn = document.getElementById("mute-btn");
const volume = document.getElementById("volume");
const listeners = document.getElementById("listeners");

function syncPlayBtn() {
  const playing = !player.paused && !player.ended;
  playBtn.classList.toggle("playing", playing);
  playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
}

playBtn.addEventListener("click", () => {
  if (player.paused) {
    player.src = player.src += `?cachebust=${new Date().getTime()}`;

    player.load();
    player.play().catch(() => {});
  } else {
    player.pause();
  }
});

player.addEventListener("play", syncPlayBtn);
player.addEventListener("playing", syncPlayBtn);
player.addEventListener("pause", syncPlayBtn);

function syncMuteBtn() {
  const muted = player.muted || player.volume === 0;
  muteBtn.classList.toggle("muted", muted);
  muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
}

volume.addEventListener("input", () => {
  player.volume = parseFloat(volume.value);
  player.muted = player.volume === 0;
  syncMuteBtn();
});

muteBtn.addEventListener("click", () => {
  player.muted = !player.muted;
  volume.value = player.muted ? 0 : player.volume || 1;
  if (!player.muted && player.volume === 0) {
    player.volume = 1;
    volume.value = 1;
  }
  syncMuteBtn();
});

function setOffline() {
  document.getElementById("dot").className = "dot offline";
  document.getElementById("status-text").textContent = "Offline";
  document.getElementById("title").textContent = "—";
  listeners.textContent = "—";
}

async function refresh() {
  try {
    const res = await fetch("/status-json.xsl", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    const stats = data.icestats || {};
    let source = stats.source;
    if (Array.isArray(source)) source = source[0];

    if (!source) {
      setOffline();
      return;
    }

    document.getElementById("dot").className = "dot online";
    document.getElementById("status-text").textContent = "Live";
    document.getElementById("name").textContent = source.server_name || "Radio";
    document.getElementById("description").textContent =
      source.server_description || "";
    document.getElementById("title").textContent =
      source.title || source.server_name || "Unknown";
    listeners.textContent = `${source.listeners ?? 0}`;
    document.title = source.server_name || "Radio Dashboard";
  } catch (e) {
    setOffline();
  }
}

refresh();
setInterval(refresh, 5000);
