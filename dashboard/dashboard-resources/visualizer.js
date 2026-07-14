const audioElement = document.querySelector("audio");

const COLUMNS_NUMBER = 16;
const SQUARES_NUMBER = COLUMNS_NUMBER / 2;

const CHARACTERS = "maletta".split("");

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

document.addEventListener("DOMContentLoaded", () => {
  const equalizer = document.getElementById("equalizer");

  const columns = Array.from({ length: COLUMNS_NUMBER }, (_, i) => {
    const column = document.createElement("div");
    column.className = "vertical";

    Array.from({ length: SQUARES_NUMBER }, (_, i) => {
      const square = document.createElement("div");
      square.className = "square";

      ((square.innerHTML = getRandom(CHARACTERS)), column.append(square));
    });

    equalizer.append(column);
  });
});

audioElement.addEventListener(
  "loadedmetadata",
  () => {
    // for cross browser
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    // load some sound
    const track = audioCtx.createMediaElementSource(audioElement);

    // initialize gain
    const gainNode = audioCtx.createGain();

    // initialize analyser
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = COLUMNS_NUMBER * 2;
    const frequencyBinsCount = analyser.frequencyBinCount;
    const buffer = new Uint8Array(frequencyBinsCount);
    track.connect(gainNode).connect(analyser).connect(audioCtx.destination);

    const columns = Array.from(document.getElementsByClassName("vertical"));

    setInterval(
      (analyser, buffer, columns) => {
        analyser.getByteFrequencyData(buffer);
        columns.forEach((column, i) => {
          const squares = (buffer[i] * SQUARES_NUMBER) / 255;

          [...column.querySelectorAll(".square")].forEach((square, index) => {
            if (!squares) {
              square.className = "square";
              return;
            }

            if (index + 1 >= squares * 2) {
              square.innerHTML = getRandom(CHARACTERS);
              square.className = "square active";
            } else if (index + 1 >= squares) {
              square.innerHTML = getRandom(CHARACTERS);
              square.className = "square active muted";
            } else {
              square.className = "square";
            }
          });
        });
      },
      COLUMNS_NUMBER,
      analyser,
      buffer,
      columns,
    );
  },
  false,
);
