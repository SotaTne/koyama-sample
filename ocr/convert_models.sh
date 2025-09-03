#!/bin/bash

# 使用方法表示関数
show_usage() {
    echo "Usage: $0 [BASE_MODEL_DIR] [OUTPUT_BASE_DIR]"
    echo ""
    echo "Arguments (in order of priority):"
    echo "  1. Command line arguments"
    echo "  2. Environment variables"
    echo "  3. Default values"
    echo ""
    echo "Command line arguments:"
    echo "  BASE_MODEL_DIR   : Source directory containing Paddle models"
    echo "  OUTPUT_BASE_DIR  : Output directory for ONNX models"
    echo ""
    echo "Environment variables:"
    echo "  PADDLE_MODEL_DIR : Source directory containing Paddle models"
    echo "  ONNX_OUTPUT_DIR  : Output directory for ONNX models"
    echo "  OPSET_VERSION    : ONNX opset version (default: 21)"
    echo ""
    echo "Default values:"
    echo "  BASE_MODEL_DIR   : ~/.paddlex/official_models"
    echo "  OUTPUT_BASE_DIR  : ./onnx_models"
    echo "  OPSET_VERSION    : 21"
    echo ""
    echo "Examples:"
    echo "  $0                                          # Use defaults"
    echo "  $0 /path/to/models                         # Custom source, default output"
    echo "  $0 /path/to/models /path/to/onnx_output   # Custom source and output"
    echo "  PADDLE_MODEL_DIR=/path/to/models $0        # Using environment variables"
    echo "  OPSET_VERSION=16 $0                       # Custom opset version"
    echo ""
}

# 引数の処理
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# 優先順位: コマンドライン引数 > 環境変数 > デフォルト値
BASE_MODEL_DIR="${1:-${PADDLE_MODEL_DIR:-~/.paddlex/official_models}}"
OUTPUT_BASE_DIR="${2:-${ONNX_OUTPUT_DIR:-./onnx_models}}"
OPSET_VERSION="${OPSET_VERSION:-21}"

# チルダ展開の処理
BASE_MODEL_DIR="${BASE_MODEL_DIR/#\~/$HOME}"
OUTPUT_BASE_DIR="${OUTPUT_BASE_DIR/#\~/$HOME}"

echo "Configuration:"
echo "  Source directory: $BASE_MODEL_DIR"
echo "  Output directory: $OUTPUT_BASE_DIR"
echo "  ONNX opset version: $OPSET_VERSION"
echo ""

# ソースディレクトリの存在確認
if [ ! -d "$BASE_MODEL_DIR" ]; then
    echo "Error: Source directory '$BASE_MODEL_DIR' does not exist!"
    echo ""
    show_usage
    exit 1
fi

# 出力ディレクトリが存在しない場合は作成
mkdir -p "$OUTPUT_BASE_DIR"

# モデル一覧を取得
MODEL_LIST=($(ls "$BASE_MODEL_DIR" 2>/dev/null))

# モデルが見つからない場合の処理
if [ ${#MODEL_LIST[@]} -eq 0 ]; then
    echo "Error: No models found in '$BASE_MODEL_DIR'"
    exit 1
fi

echo "Found ${#MODEL_LIST[@]} models to convert:"
printf '%s\n' "${MODEL_LIST[@]}"
echo "------------------------"

# 変換結果を追跡
SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_MODELS=()

# 各モデルを順次変換
for MODEL_NAME in "${MODEL_LIST[@]}"; do
    MODEL_DIR="$BASE_MODEL_DIR/$MODEL_NAME"
    ONNX_DIR="$OUTPUT_BASE_DIR/$MODEL_NAME"
    
    echo "Converting: $MODEL_NAME"
    echo "  Source: $MODEL_DIR"
    echo "  Output: $ONNX_DIR"
    
    # 入力ディレクトリの存在確認
    if [ ! -d "$MODEL_DIR" ]; then
        echo "✗ Skipped: $MODEL_NAME (not a directory)"
        ((FAILED_COUNT++))
        FAILED_MODELS+=("$MODEL_NAME")
        echo "------------------------"
        continue
    fi
    
    # 出力ディレクトリを作成
    mkdir -p "$ONNX_DIR"
    
    # ONNX変換実行
    paddlex --paddle2onnx \
        --paddle_model_dir "$MODEL_DIR" \
        --onnx_model_dir "$ONNX_DIR" \
        --opset_version "$OPSET_VERSION"
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully converted: $MODEL_NAME"
        ((SUCCESS_COUNT++))
    else
        echo "✗ Failed to convert: $MODEL_NAME"
        ((FAILED_COUNT++))
        FAILED_MODELS+=("$MODEL_NAME")
    fi
    echo "------------------------"
done

# 結果サマリー
echo "Conversion Summary:"
echo "  Total models: ${#MODEL_LIST[@]}"
echo "  Successfully converted: $SUCCESS_COUNT"
echo "  Failed: $FAILED_COUNT"

if [ $FAILED_COUNT -gt 0 ]; then
    echo "  Failed models:"
    printf '    - %s\n' "${FAILED_MODELS[@]}"
fi

echo ""
echo "All conversions completed!"
echo "Output directory: $OUTPUT_BASE_DIR"

# 失敗があった場合は非ゼロで終了
exit $FAILED_COUNT