# Polygon Image Clipper

下記文章は Claude 3.5 Sonnet によって生成されました

PDF ファイルをアップロードし、ページを画像として表示、多角形で選択した領域を切り取ってダウンロードできる Web アプリケーションです。

## 主な機能

1. PDF ファイルのアップロードと画像変換

   - PDF の各ページを画像(JPEG)に変換
   - 高品質な変換のため、scale: 3 で描画

2. 画像表示と操作

   - ウィンドウ幅に合わせた自動リサイズ
   - ページ切り替え機能
   - クリックによる頂点の配置
   - ドラッグ&ドロップによる頂点位置の調整

3. 切り取り領域の指定

   - 3 点以上のクリックで多角形を形成
   - 赤線で領域を可視化
   - 頂点の番号表示
   - 頂点のドラッグ操作に対応

4. 画像の切り取りとダウンロード
   - 指定した多角形領域で画像をクリップ
   - JPEG 形式でダウンロード
   - ファイル名に元のページ番号を含む

## 技術スタック

- Vite
- React
- TypeScript
- pdf.js (PDF の描画)
- Canvas API (画像操作)
- shadcn/ui (UI コンポーネント)

## 主要なコンポーネントと機能

### PDF 変換機能 (`convertPDFToBase64Images`)

```typescript
const convertPDFToBase64Images = async (file: File): Promise<string[]>
```

- PDF ファイルを受け取り、各ページを Base64 エンコードされた画像に変換
- pdf.js を使用して PDF を描画
- 高品質な出力のため scale: 3 を使用

### 状態管理

```typescript
const [images, setImages] = useState<string[]>([]); // 変換された画像リスト
const [selectedPoints, setSelectedPoints] = useState<
  { x: number; y: number }[]
>([]); // 選択された頂点
const [currentImageIndex, setCurrentImageIndex] = useState(0); // 現在のページ
const [dragPointIndex, setDragPointIndex] = useState<number | null>(null); // ドラッグ中の頂点
```

### マウス操作処理

- `handleMouseDown`: 頂点の配置またはドラッグ開始
- `handleMouseMove`: 頂点のドラッグ処理
- `handleMouseUp`: ドラッグ終了

### 描画処理

```typescript
useEffect(() => {
  // キャンバスへの画像描画
  // 多角形の描画
  // 頂点の描画
}, [images, currentImageIndex, selectedPoints, windowWidth]);
```

### 画像切り取り処理 (`handleDownload`)

1. 選択領域の範囲を計算
2. 新しいキャンバスを作成
3. クリッピングパスを設定
4. 画像を描画
5. JPEG としてダウンロード

## 使用方法

1. PDF ファイルをアップロード
2. 表示された画像上でクリックして頂点を配置（3 点以上）
3. 必要に応じて頂点をドラッグして位置を調整
4. 「Download Clipped Image」ボタンをクリックして切り取った画像をダウンロード

## 補足機能

- レスポンシブ対応（ウィンドウサイズに応じた表示調整）
- ローディング表示
- 頂点のドラッグ可能表示（カーソル変更）
- エラーハンドリング

## 今後の改善点

1. 頂点の削除機能
2. Undo/Redo 機能
3. グリッドへのスナップ機能
4. プレビュー表示
5. 画像フォーマットの選択
6. 高度な画像処理オプション

このアプリケーションは、PDF からの画像切り取りを直感的な UI で実現し、特に定型的な領域の切り取りが必要な業務などで活用できます。
