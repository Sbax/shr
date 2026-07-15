const audioElement = document.querySelector("audio");

const VISUALIZER = {
  columns: 16,
  barsPerColumn: 2,
  characters: "maletta".split(""),
};

const AUDIO_ANALYSIS = {
  fftSize: 256,
  minBinIndex: 1,
  maxBinRatio: 0.82,
  binDistributionExponent: 0.78,
};

const DISPLAY_SHAPING = {
  levelExponent: 1.2,
  outputHeadroom: 0.9,
  trebleBoost: 1.75,
  middleEmphasis: 0.45,
  spatialSmoothingPasses: 2,
  temporalSmoothing: 0.72,
};

const NORMALIZATION = {
  noiseFloorPercentile: 0.25,
  ceilingPercentile: 0.93,
};

const AGC = {
  smoothing: 0.94,
  strength: 0.85,
  minGain: 0.7,
  maxGain: 3,
};

const SQUARES_PER_COLUMN = VISUALIZER.columns / 2;

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPercentileValue = (sortedValues, percentile) => {
  const index = Math.floor((sortedValues.length - 1) * percentile);
  return sortedValues[index] ?? 0;
};

// Blend neighboring columns to reduce harsh one-column spikes.
const applySpatialSmoothing = (peaks, passes) => {
  return Array.from({ length: passes }).reduce(
    (smoothed) =>
      smoothed.map((peak, i, arr) => {
        const left = arr[i - 1] ?? peak;
        const right = arr[i + 1] ?? peak;
        return (left + peak * 2 + right) / 4;
      }),
    [...peaks],
  );
};

const getColumnPeak = (buffer, columnIndex, totalColumns, maxUsableBin) => {
  const totalMappedBars = totalColumns * VISUALIZER.barsPerColumn;
  const peak = Array.from(
    { length: VISUALIZER.barsPerColumn },
    (_, barOffset) => {
      const mappedBarIndex = columnIndex * VISUALIZER.barsPerColumn + barOffset;
      const normalizedBarIndex =
        mappedBarIndex / Math.max(totalMappedBars - 1, 1);
      const curvedBarIndex = Math.pow(
        normalizedBarIndex,
        AUDIO_ANALYSIS.binDistributionExponent,
      );
      const sourceBin =
        AUDIO_ANALYSIS.minBinIndex +
        Math.round(
          curvedBarIndex * (maxUsableBin - AUDIO_ANALYSIS.minBinIndex),
        );
      return buffer[Math.min(sourceBin, buffer.length - 1)] ?? 0;
    },
  ).reduce((maxValue, value) => Math.max(maxValue, value), 0);

  // Progressively boost high-frequency columns so treble stays visible.
  const normalizedColumn = columnIndex / Math.max(totalColumns - 1, 1);
  return peak * (1 + normalizedColumn * DISPLAY_SHAPING.trebleBoost);
};

const getActiveSquaresCount = (normalizedLevel) => {
  const shapedPeak = Math.pow(normalizedLevel, DISPLAY_SHAPING.levelExponent);
  const scaledPeak = Math.min(shapedPeak * DISPLAY_SHAPING.outputHeadroom, 1);
  return clamp(
    Math.round(scaledPeak * SQUARES_PER_COLUMN),
    0,
    SQUARES_PER_COLUMN,
  );
};

const updateColumnSquares = (column, activeSquares) => {
  const squares = column.querySelectorAll(".square");

  squares.forEach((square, index) => {
    const squareLevel = SQUARES_PER_COLUMN - index;

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
      square.innerHTML = getRandom(VISUALIZER.characters);
    }

    square.className = activeClass;
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const equalizer = document.getElementById("equalizer");

  // Build static column/square DOM once; only classes/content change per frame.
  Array.from({ length: VISUALIZER.columns }, () => {
    const column = document.createElement("div");
    column.className = "vertical";

    Array.from({ length: SQUARES_PER_COLUMN }, () => {
      const square = document.createElement("div");
      square.className = "square";
      square.innerHTML = getRandom(VISUALIZER.characters);
      column.append(square);
    });

    equalizer.append(column);
  });
});

audioElement.addEventListener(
  "loadedmetadata",
  () => {
    // Use prefixed AudioContext fallback for older WebKit-based browsers.
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    // Feed the media element into Web Audio processing nodes.
    const track = audioCtx.createMediaElementSource(audioElement);

    // Keep a gain node in the chain in case volume shaping is added later.
    const gainNode = audioCtx.createGain();

    // FFT analyser is the source of per-frequency magnitudes each frame.
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = AUDIO_ANALYSIS.fftSize;
    analyser.smoothingTimeConstant = 0.75;
    const frequencyBinsCount = analyser.frequencyBinCount;
    const buffer = new Uint8Array(frequencyBinsCount);
    track.connect(gainNode).connect(analyser).connect(audioCtx.destination);

    const columns = Array.from(document.getElementsByClassName("vertical"));
    const smoothedLevels = new Array(columns.length).fill(0);
    const columnEnergyAverages = new Array(columns.length).fill(1);
    const center = (columns.length - 1) / 2;
    const maxUsableBin = Math.max(
      AUDIO_ANALYSIS.minBinIndex,
      Math.min(
        buffer.length - 1,
        Math.floor((buffer.length - 1) * AUDIO_ANALYSIS.maxBinRatio),
      ),
    );

    setInterval(() => {
      analyser.getByteFrequencyData(buffer);

      // Map non-linearly from display columns to FFT bins (more detail in lows).
      const basePeaks = columns.map((_, i) =>
        getColumnPeak(buffer, i, columns.length, maxUsableBin),
      );

      // Mild center emphasis so the visualizer reads as a coherent block.
      const centerWeightedPeaks = basePeaks.map((peak, i) => {
        const distanceFromCenter = Math.abs(i - center) / Math.max(center, 1);
        const centerBoost =
          1 + (1 - distanceFromCenter) * DISPLAY_SHAPING.middleEmphasis;
        return peak * centerBoost;
      });

      const smoothedPeaks = applySpatialSmoothing(
        centerWeightedPeaks,
        DISPLAY_SHAPING.spatialSmoothingPasses,
      );
      const frameAveragePeak =
        smoothedPeaks.reduce((sum, peak) => sum + peak, 0) /
        Math.max(smoothedPeaks.length, 1);

      // Per-column AGC keeps quiet bands from disappearing behind louder bands.
      const equalizedPeaks = smoothedPeaks.map((peak, i) => {
        columnEnergyAverages[i] =
          columnEnergyAverages[i] * AGC.smoothing + peak * (1 - AGC.smoothing);

        const gainRatio =
          frameAveragePeak / Math.max(columnEnergyAverages[i], 1);
        const gain = clamp(
          Math.pow(gainRatio, AGC.strength),
          AGC.minGain,
          AGC.maxGain,
        );

        return peak * gain;
      });

      const sortedPeaks = [...equalizedPeaks].sort((a, b) => a - b);
      const floor = getPercentileValue(
        sortedPeaks,
        NORMALIZATION.noiseFloorPercentile,
      );
      const ceiling =
        getPercentileValue(sortedPeaks, NORMALIZATION.ceilingPercentile) || 1;
      const dynamicRange = Math.max(ceiling - floor, 1);

      columns.forEach((column, i) => {
        // Normalize with percentile floor/ceiling to reject noise and transient spikes.
        const normalizedPeak = clamp(
          (equalizedPeaks[i] - floor) / dynamicRange,
          0,
          1,
        );

        // Temporal smoothing stabilizes motion between frames.
        smoothedLevels[i] =
          smoothedLevels[i] * DISPLAY_SHAPING.temporalSmoothing +
          normalizedPeak * (1 - DISPLAY_SHAPING.temporalSmoothing);

        const activeSquares = getActiveSquaresCount(smoothedLevels[i]);
        updateColumnSquares(column, activeSquares);
      });
    }, VISUALIZER.columns);
  },
  false,
);
