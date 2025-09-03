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
const charWhitelist  = "西条酒蔵通りまちあるきMAP"//= Array.from(chars).join("") + "sagtbSAGRTB1234567890";

export class Recognizer {
  private worker: Tesseract.Worker;

  private constructor(worker: Tesseract.Worker) {
    this.worker = worker;
  }

  static async create(): Promise<Recognizer> {
    const worker = await Tesseract.createWorker('jpn');
    worker.setParameters({
      //tessedit_char_whitelist: charWhitelist,
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // 領域分割モード
      preserve_interword_spaces: '1', // 空白を正確に扱う
      user_defined_dpi: '300' // 低解像度画像の場合必須
    });
    return new Recognizer(worker);
  }

  async recognizeText(image: HTMLCanvasElement): Promise<Block[]> {
    if (image instanceof HTMLCanvasElement === false) {
      throw new Error("Invalid image element");
    }
    const {data} = await this.worker.recognize(
      image,
      {},
      {
        blocks:true,
        text:true,
      }
    );
    console.log("result text:",data.text);
    const {blocks} = data;
    console.log("result data json:", JSON.stringify(data, null, 2));
    console.log("result data:", data);
    if (Array.isArray(blocks) && blocks.length === 0) {
      for (const block of blocks) {
        if (block.text && block.text.trim() !== "") {
          console.log("Recognized block:", JSON.stringify(block, null, 2));
          console.log("Recognized text:", block.text);
        }
      }
    }
    return blocks || [];
  }

  async terminate() {
    await this.worker.terminate();
  }

  async process(inputCanvas:HTMLCanvasElement): Promise<Block[]> {
    console.log("start recognize")
    const blocks = await this.recognizeText(inputCanvas);
    // await this.terminate();
    return blocks;
  }
}