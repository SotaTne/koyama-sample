import model

import time


start = time.perf_counter() #計測開始

# サンプル画像でOCR推論を実行
result = model.ocr.predict(
    input="./banyuukan.png")

end = time.perf_counter() #計測終了

print('time: {:.2f}'.format((end-start)/60))

# 結果を可視化し、JSON形式で保存
for res in result:
    res.print()
    res.save_to_img("output")
    res.save_to_json("output")
    
