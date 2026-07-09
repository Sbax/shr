function updateEqualizer(analyser, buffer, columns) {
  analyser.getByteFrequencyData(buffer);
  for (let i = 0; i < columns.length; i += 1) {
    let column = columns[i];
    const height = (buffer[i] / 255) * 40 + 5;
    column.setAttribute("style", `height: ${height}px`);
  }
}

const audioElement = document.querySelector("audio");

audioElement.addEventListener(
  "loadedmetadata",
  (event) => {
    // for cross browser
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    // load some sound
    const track = audioCtx.createMediaElementSource(audioElement);
    const playButton = document.querySelector("button");

    // initialize gain
    let gainNode = audioCtx.createGain();

    // initialize analyser
    let analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; //32 bins
    const frequencyBinsCount = analyser.frequencyBinCount;
    let buffer = new Uint8Array(frequencyBinsCount);
    track.connect(gainNode).connect(analyser).connect(audioCtx.destination);

    // equalizer animation
    const equalizer = document.getElementById("equalizer");
    // 32 bins -> 32 columns
    const columns = document.getElementsByClassName("vertical");
    setInterval(updateEqualizer, 16, analyser, buffer, columns);
  },
  false,
);
