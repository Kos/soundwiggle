function init<T>(obj: T, fn: (arg: T) => void) {
  fn(obj);
  return obj;
}

function parseMidiMessage(message) {
  return;
}

const NOTE_DOWN = 9;
const NOTE_UP = 8;

function createOsc(audioCtx, note) {
  // 440 * 2^{(n-69)/12}</math>
  const freq = 440 * Math.pow(2, (note - 69) / 12);
  // create Oscillator node
  const mainOscillator = init(audioCtx.createOscillator(), self => {
    self.type = "square";
    // self.frequency.setValueAtTime(440, audioCtx.currentTime); // value in hertz
    self.frequency.value = freq;
    self.connect(audioCtx.destination);
    self.start();
  });

  const lfoGain = init(audioCtx.createGain(), self => {
    self.gain.value = 70;
    self.connect(mainOscillator.frequency);
  });

  const lfo = init(audioCtx.createOscillator(), self => {
    // self.frequency.value
    self.type = "sine";
    self.frequency.value = 0;
    self.connect(lfoGain);
    self.start();
  });

  return mainOscillator;
}

function main() {
  const audioCtx = new AudioContext();
  const oscMap = new Map<Number, OscillatorNode>();

  navigator.requestMIDIAccess().then(function(access) {
    access.inputs.forEach(input => {
      console.log("Input device:", input);
      input.onmidimessage = ({ data }) => {
        const message = {
          command: data[0] >> 4,
          channel: data[0] & 0xf,
          note: data[1],
          velocity: data[2] / 127
        };
        if (message.command == NOTE_DOWN) {
          console.log(oscMap);
          oscMap.set(message.note, createOsc(audioCtx, message.note));
        } else if (message.command == NOTE_UP) {
          console.log(oscMap);
          const osc = oscMap.get(message.note);
          osc.stop();
          oscMap.delete(message.note);
        }
        console.log(message);
      };
    });
    access.outputs.forEach(output => {
      console.log("Output device:", output);
    });
  });
}

main();
