# download_models.py
import paddleocr
import os

def download_paddle_models():
    """PaddleOCRの事前学習済みモデルをダウンロード"""
    
    # OCRインスタンスを作成（初回実行時にモデルが自動ダウンロードされる）
    ocr = paddleocr.PaddleOCR(
        use_angle_cls=True,  # 角度分類器を使用
        lang='japan',        # 日本語モデル
        show_log=False
    )
    
    # モデルのパスを確認
    print("テキスト検出モデル:", ocr.text_detector.model_dir)
    print("テキスト認識モデル:", ocr.text_recognizer.model_dir)
    print("角度分類モデル:", ocr.text_classifier.model_dir)
    
    return ocr

if __name__ == "__main__":
    ocr = download_paddle_models()