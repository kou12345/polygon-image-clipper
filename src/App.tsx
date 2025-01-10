import * as pdfjs from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const convertPDFToBase64Images = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;

  const base64ImageList: string[] = [];
  const canvas = document.createElement("canvas");

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = canvas.getContext("2d");
    if (!renderContext) {
      return [];
    }
    const renderTask = page.render({
      canvasContext: renderContext,
      viewport,
    });
    await renderTask.promise;

    const base64Image = canvas.toDataURL("image/jpeg");
    base64ImageList.push(base64Image);
  }

  return base64ImageList;
};

const App = () => {
  const [images, setImages] = useState<string[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // ウィンドウリサイズを監視
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // PDFファイルアップロードの処理
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const convertedImages = await convertPDFToBase64Images(file);
      setImages(convertedImages);
    } catch (error) {
      console.error("PDF conversion failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // マウスダウンの処理
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const actualWidth = canvas.width;
    const actualHeight = canvas.height;
    const scaleX = actualWidth / displayWidth;
    const scaleY = actualHeight / displayHeight;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // 既存の点の近くをクリックした場合、その点をドラッグ開始
    const pointIndex = selectedPoints.findIndex((point) => {
      const distance = Math.sqrt(
        Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
      );
      return distance < 20; // 20ピクセル以内
    });

    if (pointIndex !== -1) {
      setDragPointIndex(pointIndex);
    } else {
      setSelectedPoints([...selectedPoints, { x, y }]);
    }
  };

  // カーソルスタイルの動的な設定
  const getCanvasStyle = (event?: React.MouseEvent<HTMLCanvasElement>) => {
    const baseStyle = {
      border: "1px solid black",
      display: "block",
      maxWidth: "90%",
      margin: "0 auto",
    };

    // ドラッグ中は move カーソル
    if (dragPointIndex !== null) {
      return {
        ...baseStyle,
        cursor: "move",
      };
    }

    // マウスが頂点の近くにあるかチェック
    const canvas = canvasRef.current;
    if (canvas && event && selectedPoints.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const actualWidth = canvas.width;
      const actualHeight = canvas.height;
      const scaleX = actualWidth / displayWidth;
      const scaleY = actualHeight / displayHeight;

      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      const isNearPoint = selectedPoints.some((point) => {
        const distance = Math.sqrt(
          Math.pow(point.x - mouseX, 2) + Math.pow(point.y - mouseY, 2)
        );
        return distance < 20; // 20ピクセル以内
      });

      if (isNearPoint) {
        return {
          ...baseStyle,
          cursor: "pointer",
        };
      }
    }

    return baseStyle;
  };

  const [canvasStyle, setCanvasStyle] = useState(getCanvasStyle());

  // マウス移動の処理を更新
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // ドラッグ処理
    if (dragPointIndex !== null) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const actualWidth = canvas.width;
      const actualHeight = canvas.height;
      const scaleX = actualWidth / displayWidth;
      const scaleY = actualHeight / displayHeight;

      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      const newPoints = [...selectedPoints];
      newPoints[dragPointIndex] = { x, y };
      setSelectedPoints(newPoints);
    }

    // カーソルスタイルの更新
    setCanvasStyle(getCanvasStyle(event));
  };

  // マウスアップの処理
  const handleMouseUp = () => {
    setDragPointIndex(null);
  };

  // キャンバスへの描画処理
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images[currentImageIndex]) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 画像の描画
    const img = new Image();
    img.src = images[currentImageIndex];
    img.onload = () => {
      // 画像の元のサイズを保持
      const originalWidth = img.width;
      const originalHeight = img.height;

      // ウィンドウ幅に合わせてスケールを計算（余白を考慮して0.9をかける）
      const maxWidth = windowWidth * 0.9;
      const scale = Math.min(1, maxWidth / originalWidth);

      // キャンバスのサイズを設定
      canvas.width = originalWidth;
      canvas.height = originalHeight;

      // 実際の表示サイズをスタイルで制御
      canvas.style.width = `${originalWidth * scale}px`;
      canvas.style.height = `${originalHeight * scale}px`;

      ctx.drawImage(img, 0, 0);

      // クリック座標の変換に使用するスケール情報を保存
      canvas.dataset.scale = scale.toString();

      // ポリゴンの描画
      if (selectedPoints.length > 0) {
        // ラインの描画
        ctx.beginPath();
        ctx.moveTo(selectedPoints[0].x, selectedPoints[0].y);
        selectedPoints.forEach((point, index) => {
          if (index > 0) {
            ctx.lineTo(point.x, point.y);
          }
        });
        if (selectedPoints.length > 2) {
          ctx.closePath();
        }
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.stroke();

        // 点の描画
        selectedPoints.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "red";
          ctx.fill();

          // 点の番号を描画（オプション）
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 10px Arial";
          ctx.fillText((index + 1).toString(), point.x, point.y);
        });
      }
    };
  }, [images, currentImageIndex, selectedPoints, windowWidth]);

  // クリップした画像のダウンロード
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || selectedPoints.length < 3) return;

    // 元の画像を読み込み
    const img = new Image();
    img.src = images[currentImageIndex];
    img.onload = () => {
      // バウンディングボックスの計算
      const minX = Math.min(...selectedPoints.map((p) => p.x));
      const minY = Math.min(...selectedPoints.map((p) => p.y));
      const maxX = Math.max(...selectedPoints.map((p) => p.x));
      const maxY = Math.max(...selectedPoints.map((p) => p.y));
      const width = maxX - minX;
      const height = maxY - minY;

      // 新しいキャンバスを作成（クリップ領域のサイズに設定）
      const clipCanvas = document.createElement("canvas");
      clipCanvas.width = width;
      clipCanvas.height = height;
      const clipCtx = clipCanvas.getContext("2d");
      if (!clipCtx) return;

      // クリッピングパスの作成（座標を相対位置に変換）
      clipCtx.beginPath();
      clipCtx.moveTo(selectedPoints[0].x - minX, selectedPoints[0].y - minY);
      selectedPoints.forEach((point, index) => {
        if (index > 0) {
          clipCtx.lineTo(point.x - minX, point.y - minY);
        }
      });
      clipCtx.closePath();
      clipCtx.clip();

      // 画像を描画（クリップ領域の位置を考慮してオフセット）
      clipCtx.drawImage(img, minX, minY, width, height, 0, 0, width, height);

      // ダウンロード
      const link = document.createElement("a");
      link.download = `clipped-image-${currentImageIndex}.jpg`;
      link.href = clipCanvas.toDataURL("image/jpeg");
      link.click();
    };
  };

  return (
    <div style={{ padding: "20px" }}>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        disabled={isLoading}
      />

      {isLoading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "20px",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          <p className="text-sm text-gray-600">Converting PDF...</p>
        </div>
      )}

      {!isLoading && images.length > 0 && (
        <div>
          <div style={{ marginBottom: "10px" }}>
            {images.map((_, index) => (
              <Button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                style={{ marginRight: "5px" }}
              >
                Page {index + 1}
              </Button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                setDragPointIndex(null);
                setCanvasStyle(getCanvasStyle());
              }}
              style={canvasStyle}
            />
          </div>

          <div style={{ marginTop: "10px" }}>
            <Button
              onClick={() => setSelectedPoints([])}
              style={{ marginRight: "10px" }}
            >
              Clear Points
            </Button>
            <Button
              onClick={handleDownload}
              disabled={selectedPoints.length < 3}
            >
              Download Clipped Image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
