function init<T>(obj: T, fn: (arg: T) => void) {
  fn(obj);
  return obj;
}

type Note = Number;
type Params = Array<Number>;

interface InstrumentVoice {
  stop: () => void;
  setParam: (note, value) => void;
}

interface Instrument {
  play: (note: Note, params: Params) => InstrumentVoice;
}

class Voice implements InstrumentVoice {
  stop() {}
  setParam(note, value) {}

  addRelease(param: AudioParam, time: number, context: AudioContext) {
    this.stop = sequenceFn(this.stop, () => {
      param.linearRampToValueAtTime(0, context.currentTime + time);
    });
    return this;
  }

  addParam(note, param: AudioParam, min, max) {
    this.setParam = sequenceFn(this.setParam, (thisNote, value) => {
      if (note === thisNote) {
        param.value = min + (max - min) * value;
      }
    });
    return this;
  }

  setParams(params: Params) {
    params.forEach((element, index) => {
      this.setParam(index, element);
    });
    return this;
  }
}

function sequenceFn(a, b) {
  return (...args) => {
    a(...args);
    b(...args);
  };
}

class ADSR {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  context: AudioContext;

  constructor(params, offset, context) {
    this.attack = params[offset];
    this.decay = params[offset + 1];
    this.sustain = params[offset + 2];
    this.release = params[offset + 3];
    this.context = context;
  }

  scheduleAttack(param: AudioParam, value: number) {
    param.linearRampToValueAtTime(
      value,
      this.context.currentTime + this.attack * 0.5
    );
  }
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
    const adsr = new ADSR(params, 4, this.audioCtx);

    const mainGain = init(audioCtx.createGain(), self => {
      self.gain.value = 0;
      adsr.scheduleAttack(self.gain, 0.3);
    });
    const mainOscillator = init(audioCtx.createOscillator(), self => {
      self.type = "square";
      self.frequency.value = noteFrequency(note);
      self.detune.value = 0;
      self.start();
    });
    const filter = init(audioCtx.createBiquadFilter(), self => {
      self.type = "lowpass";
    });

    chain(mainOscillator, filter, mainGain, this.output);

    return new Voice()
      .addRelease(mainGain.gain, 0.01, audioCtx)
      .addParam(0, filter.frequency, 0, 5000)
      .setParams(params);
  }
}

function noteFrequency(note: Note) {
  return 440 * Math.pow(2, (Number(note) - 69) / 12);
}

const NOTE_DOWN = 9;
const NOTE_UP = 8;
const PARAM_SET = 11;

function connectInstrument(
  oscMap: Map<Number, InstrumentVoice>,
  instrument: Instrument,
  inputDevice: WebMidi.MIDIInput
) {
  const params = new Array(16);
  params.fill(0.5);

  inputDevice.onmidimessage = ({ data }) => {
    const message = {
      command: data[0] >> 4,
      channel: data[0] & 0xf,
      note: data[1],
      velocity: data[2] / 127
    };
    if (message.command === NOTE_DOWN) {
      oscMap.set(message.note, instrument.play(message.note, params));
    } else if (message.command === NOTE_UP) {
      const voice = oscMap.get(message.note);
      voice.stop();
      oscMap.delete(message.note);
    } else if (message.command === PARAM_SET) {
      console.log("PARAM_SET", message);
      if (message.note < 8) {
        params[message.note] = message.velocity;
        oscMap.forEach(voice => voice.setParam(message.note, message.velocity));
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
