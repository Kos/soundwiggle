function init<T>(obj: T, fn: (arg: T) => void) {
  fn(obj);
  return obj;
}

type Note = Number;

interface InstrumentVoice {
  stop: () => void;
}

interface Instrument {
  play: (note: Note) => InstrumentVoice;
}

class Square implements Instrument {
  audioCtx: AudioContext;
  output: AudioNode;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.output = audioCtx.destination;
  }

  play(note) {
    const { audioCtx } = this;

    const mainGain = init(audioCtx.createGain(), self => {
      self.gain.value = 0.3;
    });
    const mainOscillator = init(audioCtx.createOscillator(), self => {
      self.type = "square";
      self.frequency.value = noteFrequency(note);
      self.start();
    });

    chain(mainOscillator, mainGain, this.output);

    return {
      stop() {
        const releaseTime = 0.01;
        mainGain.gain.linearRampToValueAtTime(
          0,
          audioCtx.currentTime + releaseTime
        );
        mainOscillator.stop(audioCtx.currentTime + releaseTime);
      }
    };
  }
}

function noteFrequency(note: Note) {
  return 440 * Math.pow(2, (Number(note) - 69) / 12);
}

const NOTE_DOWN = 9;
const NOTE_UP = 8;

function connectInstrument(
  instrument: Instrument,
  inputDevice: WebMidi.MIDIInput
) {
  const oscMap = new Map<Number, InstrumentVoice>();

  inputDevice.onmidimessage = ({ data }) => {
    const message = {
      command: data[0] >> 4,
      channel: data[0] & 0xf,
      note: data[1],
      velocity: data[2] / 127
    };
    if (message.command == NOTE_DOWN) {
      oscMap.set(message.note, instrument.play(message.note));
    } else if (message.command == NOTE_UP) {
      const voice = oscMap.get(message.note);
      voice.stop();
      oscMap.delete(message.note);
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
  const square = new Square(audioCtx);
  const comp = init(audioCtx.createDynamicsCompressor(), self => {});
  square.output = comp;
  comp.connect(audioCtx.destination);

  navigator.requestMIDIAccess().then(function(access) {
    access.inputs.forEach(input => {
      console.log("Input device:", input);
      connectInstrument(square, input);
    });
    access.outputs.forEach(output => {
      console.log("Output device:", output);
    });
  });
}

main();
