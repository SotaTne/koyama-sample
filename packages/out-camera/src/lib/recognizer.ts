import Tesseract,{Block} from "tesseract.js";

const all_architect = [
  "天地館",
  "万有館",
  "本館",
  "雄飛館",
  "心理館",
];

const string = all_architect.join("");
const chars = new Set(string.split(""));
const charWhitelist = Array.from(chars).join("") + "sagtbSAGRTB1234567890";

export class Recognizer {
  private worker: Tesseract.Worker;

  private constructor(worker: Tesseract.Worker) {
    this.worker = worker;
  }

  static async create(): Promise<Recognizer> {
    const worker = await Tesseract.createWorker('jpn');
    worker.setParameters({
      tessedit_char_whitelist: charWhitelist
    });
    return new Recognizer(worker);
  }

  async recognizeText(image: HTMLCanvasElement): Promise<Block[]> {
    const {data} = await this.worker.recognize(image);
    const {blocks} = data;
    return blocks || [];
  }

  async terminate() {
    await this.worker.terminate();
  }

  async process(inputCanvas:HTMLCanvasElement): Promise<Block[]> {
    const blocks = await this.recognizeText(inputCanvas);
    await this.terminate();
    return blocks;
  }
}