const audioElement = document.querySelector("audio");

const COLUMNS_NUMBER = 16;
const SQUARES_NUMBER = COLUMNS_NUMBER / 2;
const BARS_PER_COLUMN = 2;
const FFT_SIZE = 256;
const MIN_BIN_INDEX = 1;
const MAX_BIN_RATIO = 0.82;
const BIN_DISTRIBUTION_EXPONENT = 0.78;
const LEVEL_EXPONENT = 1.2;
const OUTPUT_HEADROOM = 0.9;
const TREBLE_BOOST = 1.75;
const NOISE_FLOOR_PERCENTILE = 0.25;
const CEILING_PERCENTILE = 0.93;
const MIDDLE_EMPHASIS = 0.45;
const SPATIAL_SMOOTHING_PASSES = 2;
const TEMPORAL_SMOOTHING = 0.72;
const COLUMN_AGC_SMOOTHING = 0.94;
const COLUMN_AGC_STRENGTH = 0.85;
const MIN_COLUMN_GAIN = 0.7;
const MAX_COLUMN_GAIN = 3;

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
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.75;
    const frequencyBinsCount = analyser.frequencyBinCount;
    const buffer = new Uint8Array(frequencyBinsCount);
    track.connect(gainNode).connect(analyser).connect(audioCtx.destination);

    const columns = Array.from(document.getElementsByClassName("vertical"));
    const smoothedLevels = new Array(columns.length).fill(0);
    const columnEnergyAverages = new Array(columns.length).fill(1);

    setInterval(
      (analyser, buffer, columns) => {
        analyser.getByteFrequencyData(buffer);
        const totalMappedBars = columns.length * BARS_PER_COLUMN;
        const maxUsableBin = Math.max(
          MIN_BIN_INDEX,
          Math.min(
            buffer.length - 1,
            Math.floor((buffer.length - 1) * MAX_BIN_RATIO),
          ),
        );

        const columnPeaks = columns.map((_, i) => {
          const columnBars = Array.from(
            { length: BARS_PER_COLUMN },
            (_, barOffset) => {
              const mappedBarIndex = i * BARS_PER_COLUMN + barOffset;
              const normalizedBarIndex =
                mappedBarIndex / Math.max(totalMappedBars - 1, 1);
              const curvedBarIndex = Math.pow(
                normalizedBarIndex,
                BIN_DISTRIBUTION_EXPONENT,
              );
              const sourceBin =
                MIN_BIN_INDEX +
                Math.round(curvedBarIndex * (maxUsableBin - MIN_BIN_INDEX));
              return buffer[Math.min(sourceBin, buffer.length - 1)];
            },
          );
          const columnPeak = Math.max(...columnBars, 0);
          const normalizedIndex = i / Math.max(columns.length - 1, 1);
          const compensation = 1 + normalizedIndex * TREBLE_BOOST;
          return columnPeak * compensation;
        });

        const center = (columns.length - 1) / 2;
        const centerWeightedPeaks = columnPeaks.map((peak, i) => {
          const distanceFromCenter = Math.abs(i - center) / Math.max(center, 1);
          const centerBoost = 1 + (1 - distanceFromCenter) * MIDDLE_EMPHASIS;
          return peak * centerBoost;
        });

        let smoothedPeaks = [...centerWeightedPeaks];
        for (let pass = 0; pass < SPATIAL_SMOOTHING_PASSES; pass += 1) {
          smoothedPeaks = smoothedPeaks.map((peak, i, arr) => {
            const left = arr[i - 1] ?? peak;
            const right = arr[i + 1] ?? peak;
            return (left + peak * 2 + right) / 4;
          });
        }

        const frameAveragePeak =
          smoothedPeaks.reduce((sum, peak) => sum + peak, 0) /
          Math.max(smoothedPeaks.length, 1);
        const equalizedPeaks = smoothedPeaks.map((peak, i) => {
          columnEnergyAverages[i] =
            columnEnergyAverages[i] * COLUMN_AGC_SMOOTHING +
            peak * (1 - COLUMN_AGC_SMOOTHING);

          const gainRatio =
            frameAveragePeak / Math.max(columnEnergyAverages[i], 1);
          const gain = Math.min(
            Math.max(Math.pow(gainRatio, COLUMN_AGC_STRENGTH), MIN_COLUMN_GAIN),
            MAX_COLUMN_GAIN,
          );

          return peak * gain;
        });

        const sortedPeaks = [...equalizedPeaks].sort((a, b) => a - b);
        const floorIndex = Math.floor(
          (sortedPeaks.length - 1) * NOISE_FLOOR_PERCENTILE,
        );
        const ceilingIndex = Math.floor(
          (sortedPeaks.length - 1) * CEILING_PERCENTILE,
        );
        const floor = sortedPeaks[floorIndex] ?? 0;
        const ceiling = sortedPeaks[ceilingIndex] ?? 1;
        const dynamicRange = Math.max(ceiling - floor, 1);

        columns.forEach((column, i) => {
          const normalizedPeak = Math.min(
            Math.max((equalizedPeaks[i] - floor) / dynamicRange, 0),
            1,
          );
          smoothedLevels[i] =
            smoothedLevels[i] * TEMPORAL_SMOOTHING +
            normalizedPeak * (1 - TEMPORAL_SMOOTHING);

          const shapedPeak = Math.pow(smoothedLevels[i], LEVEL_EXPONENT);
          const scaledPeak = Math.min(shapedPeak * OUTPUT_HEADROOM, 1);
          const activeSquares = Math.max(
            0,
            Math.min(SQUARES_NUMBER, Math.round(scaledPeak * SQUARES_NUMBER)),
          );

          [...column.querySelectorAll(".square")].forEach((square, index) => {
            const squareLevel = SQUARES_NUMBER - index;

            if (!activeSquares || squareLevel > activeSquares) {
              square.className = "square";
              return;
            }

            const isTopActiveSquare =
              squareLevel >= activeSquares - 1 && squareLevel <= activeSquares;
            const activeClass = isTopActiveSquare
              ? "square active accent"
              : "square active";

            if (square.className !== activeClass) {
              square.innerHTML = getRandom(CHARACTERS);
            }

            square.className = activeClass;
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
