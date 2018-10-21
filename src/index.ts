function init<T>(obj: T, fn: (arg: T) => void) {
  fn(obj);
  return obj;
}

type Note = Number;

interface InstrumentVoice {
  stop: () => void;
  setParam: (channel, value) => void;
}

interface Instrument {
  play: (note: Note, params: Array<Number>) => InstrumentVoice;
}

class Square implements Instrument {
  audioCtx: AudioContext;
  output: AudioNode;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.output = audioCtx.destination;
  }

  play(note, params) {
    const { audioCtx } = this;

    const mainGain = init(audioCtx.createGain(), self => {
      self.gain.value = 0.3;
    });
    const mainOscillator = init(audioCtx.createOscillator(), self => {
      self.type = "square";
      self.frequency.value = noteFrequency(note);
      self.detune.value = 0;
      self.start();
    });
    const filter = init(audioCtx.createBiquadFilter(), self => {
      self.type = "lowpass";
      self.frequency.value = params[0] * 5000;
    });

    chain(mainOscillator, filter, mainGain, this.output);

    return {
      stop() {
        const releaseTime = 0.01;
        mainGain.gain.linearRampToValueAtTime(
          0,
          audioCtx.currentTime + releaseTime
        );
        mainOscillator.stop(audioCtx.currentTime + releaseTime);
      },

      setParam(channel, value) {
        console.log("setParam", channel, value);
        if (channel === 0) {
          filter.frequency.value = value * 5000;
        }
      }
    };
  }
}

function noteFrequency(note: Note) {
  return 440 * Math.pow(2, (Number(note) - 69) / 12);
}

const NOTE_DOWN = 9;
const NOTE_UP = 8;
const PARAM_SET = 11;

function connectInstrument(
  oscMap: Map<Number, InstrumentVoice>.
  instrument: Instrument,
  inputDevice: WebMidi.MIDIInput
) {
  const params = new Array(8);
  params.fill(0.5);

  inputDevice.onmidimessage = ({ data }) => {
    const message = {
      command: data[0] >> 4,
      channel: data[0] & 0xf,
      note: data[1],
      velocity: data[2] / 127
    };
    console.log(message);
    if (message.command === NOTE_DOWN) {
      oscMap.set(message.note, instrument.play(message.note, params));
      console.log("?", oscMap);
    } else if (message.command === NOTE_UP) {
      const voice = oscMap.get(message.note);
      voice.stop();
      oscMap.delete(message.note);
      console.log("?", oscMap);
    } else if (message.command === PARAM_SET) {
      if (message.channel < 8) {
        params[message.channel] = message.velocity;
        console.log("!", oscMap);
        oscMap.forEach(voice =>
          voice.setParam(message.channel, message.velocity)
        );
      }
    }
  };
}

function chain(...pieces) {
  for (let i = 0; i < pieces.length - 1; ++i) {
    pieces[i].connect(pieces[i + 1]);
  }
}
function main() {
  const audioCtx = new AudioContext();
  const oscMap = new Map<Number, InstrumentVoice>();

  const square = new Square(audioCtx);
  // const comp = init(audioCtx.createDynamicsCompressor(), self => {});
  // square.output = comp;
  // comp.connect(audioCtx.destination);

  navigator.requestMIDIAccess().then(function(access) {
    access.inputs.forEach(input => {
      console.log("Input device:", input);
      connectInstrument(oscMap, square, input);
    });
    access.outputs.forEach(output => {
      console.log("Output device:", output);
    });
  });
}

main();
