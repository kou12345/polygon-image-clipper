import * as pdfjs from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Point = {
  x: number;
  y: number;
};

// PDF変換ユーティリティ
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
    if (!renderContext) return [];

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

// ローディングコンポーネント
const LoadingSpinner = () => (
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
);

// ページ選択コンポーネント
const PageSelector = ({
  pageCount,
  onPageChange,
}: {
  pageCount: number;
  currentPage: number;
  onPageChange: (index: number) => void;
}) => (
  <div style={{ marginBottom: "10px" }}>
    {Array.from({ length: pageCount }).map((_, index) => (
      <Button
        key={index}
        onClick={() => onPageChange(index)}
        style={{ marginRight: "5px" }}
      >
        Page {index + 1}
      </Button>
    ))}
  </div>
);

// クリップされた画像カードコンポーネント
const ClippedImageCard = ({
  imageUrl,
  index,
  total,
  onDownload,
  onDelete,
}: {
  imageUrl: string;
  index: number;
  total: number;
  onDownload: () => void;
  onDelete: () => void;
}) => (
  <div
    style={{
      border: "1px solid #ddd",
      borderRadius: "4px",
      padding: "8px",
      backgroundColor: "white",
    }}
  >
    <img
      src={imageUrl}
      alt={`Clipped image ${index + 1}`}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        borderRadius: "2px",
      }}
    />
    <div
      style={{
        marginTop: "8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span className="text-sm text-gray-600">Clip {total - index}</span>
      <div style={{ display: "flex", gap: "4px" }}>
        <Button onClick={onDownload} size="sm">
          Download
        </Button>
        <Button onClick={onDelete} variant="destructive" size="sm">
          Delete
        </Button>
      </div>
    </div>
  </div>
);
// クリップされた画像ギャラリーコンポーネント
const ClippedImagesGallery = ({
  images,
  onDelete,
  onClearAll,
}: {
  images: string[];
  onDelete: (index: number) => void;
  onClearAll: () => void;
}) => (
  <div style={{ marginTop: "20px" }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "10px",
      }}
    >
      <h3 className="text-lg font-semibold">Clipped Images:</h3>
      <Button onClick={onClearAll} variant="destructive" size="sm">
        Clear All
      </Button>
    </div>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "16px",
        padding: "16px",
        backgroundColor: "#f5f5f5",
        borderRadius: "8px",
      }}
    >
      {images.map((imageUrl, index) => (
        <ClippedImageCard
          key={index}
          imageUrl={imageUrl}
          index={index}
          total={images.length}
          onDelete={() => onDelete(index)}
          onDownload={() => {
            const link = document.createElement("a");
            link.download = `clipped-image-${index}.jpg`;
            link.href = imageUrl;
            link.click();
          }}
        />
      ))}
    </div>
  </div>
);

// キャンバス操作フック
const useCanvasOperations = () => {
  const getCanvasCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ): Point => {
    const rect = canvas.getBoundingClientRect();
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const actualWidth = canvas.width;
    const actualHeight = canvas.height;
    const scaleX = actualWidth / displayWidth;
    const scaleY = actualHeight / displayHeight;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const drawCanvas = (
    canvas: HTMLCanvasElement,
    image: string,
    points: Point[],
    windowWidth: number
  ) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      const originalWidth = img.width;
      const originalHeight = img.height;
      const maxWidth = windowWidth * 0.9;
      const scale = Math.min(1, maxWidth / originalWidth);

      canvas.width = originalWidth;
      canvas.height = originalHeight;
      canvas.style.width = `${originalWidth * scale}px`;
      canvas.style.height = `${originalHeight * scale}px`;

      ctx.drawImage(img, 0, 0);
      canvas.dataset.scale = scale.toString();

      if (points.length > 0) {
        // Draw polygon
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach((point, index) => {
          if (index > 0) ctx.lineTo(point.x, point.y);
        });
        if (points.length > 2) ctx.closePath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw points
        points.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "red";
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 10px Arial";
          ctx.fillText((index + 1).toString(), point.x, point.y);
        });
      }
    };
  };

  return { getCanvasCoordinates, drawCanvas };
};

// メインアプリケーション
const App = () => {
  const [images, setImages] = useState<string[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<Point[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);
  const [clippedImages, setClippedImages] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // カーソルスタイルの動的な設定
  const getCanvasStyle = (event?: React.MouseEvent<HTMLCanvasElement>) => {
    const baseStyle = {
      border: "1px solid black",
      display: "block",
      maxWidth: "90%",
      margin: "0 auto",
    };

    if (dragPointIndex !== null) {
      return { ...baseStyle, cursor: "move" };
    }

    const canvas = canvasRef.current;
    if (canvas && event && selectedPoints.length > 0) {
      const coords = getCanvasCoordinates(event, canvas);
      const isNearPoint = selectedPoints.some((point) => {
        const distance = Math.sqrt(
          Math.pow(point.x - coords.x, 2) + Math.pow(point.y - coords.y, 2)
        );
        return distance < 20;
      });

      if (isNearPoint) {
        return { ...baseStyle, cursor: "pointer" };
      }
    }

    return baseStyle;
  };
  const [canvasStyle, setCanvasStyle] = useState(getCanvasStyle());

  const { getCanvasCoordinates, drawCanvas } = useCanvasOperations();

  // ウィンドウリサイズを監視
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // キャンバス描画の更新
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images[currentImageIndex]) return;

    drawCanvas(canvas, images[currentImageIndex], selectedPoints, windowWidth);
  }, [images, currentImageIndex, selectedPoints, windowWidth, drawCanvas]);

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

  // マウスイベントハンドラー
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(event, canvas);
    const pointIndex = selectedPoints.findIndex((point) => {
      const distance = Math.sqrt(
        Math.pow(point.x - coords.x, 2) + Math.pow(point.y - coords.y, 2)
      );
      return distance < 20;
    });

    if (pointIndex !== -1) {
      setDragPointIndex(pointIndex);
    } else {
      setSelectedPoints([...selectedPoints, coords]);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragPointIndex !== null) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCanvasCoordinates(event, canvas);
      const newPoints = [...selectedPoints];
      newPoints[dragPointIndex] = coords;
      setSelectedPoints(newPoints);
    }

    setCanvasStyle(getCanvasStyle(event));
  };

  const handleMouseUp = () => {
    setDragPointIndex(null);
  };

  // クリップした画像のダウンロード
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || selectedPoints.length < 3) return;

    const img = new Image();
    img.src = images[currentImageIndex];
    img.onload = () => {
      const minX = Math.min(...selectedPoints.map((p) => p.x));
      const minY = Math.min(...selectedPoints.map((p) => p.y));
      const maxX = Math.max(...selectedPoints.map((p) => p.x));
      const maxY = Math.max(...selectedPoints.map((p) => p.y));
      const width = maxX - minX;
      const height = maxY - minY;

      const clipCanvas = document.createElement("canvas");
      clipCanvas.width = width;
      clipCanvas.height = height;
      const clipCtx = clipCanvas.getContext("2d");
      if (!clipCtx) return;

      clipCtx.beginPath();
      clipCtx.moveTo(selectedPoints[0].x - minX, selectedPoints[0].y - minY);
      selectedPoints.forEach((point, index) => {
        if (index > 0) {
          clipCtx.lineTo(point.x - minX, point.y - minY);
        }
      });
      clipCtx.closePath();
      clipCtx.clip();

      clipCtx.drawImage(img, minX, minY, width, height, 0, 0, width, height);

      const clippedImageUrl = clipCanvas.toDataURL("image/jpeg");
      setClippedImages((prev) => [clippedImageUrl, ...prev]);

      const link = document.createElement("a");
      link.download = `clipped-image-${currentImageIndex}.jpg`;
      link.href = clippedImageUrl;
      link.click();
    };
  };

  // 切り取り画像の管理
  const removeClippedImage = (index: number) => {
    setClippedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllClippedImages = () => {
    setClippedImages([]);
  };

  return (
    <div style={{ padding: "20px" }}>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        disabled={isLoading}
      />

      {isLoading && <LoadingSpinner />}

      {!isLoading && images.length > 0 && (
        <div>
          <PageSelector
            pageCount={images.length}
            currentPage={currentImageIndex}
            onPageChange={setCurrentImageIndex}
          />

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

          {clippedImages.length > 0 && (
            <ClippedImagesGallery
              images={clippedImages}
              onDelete={removeClippedImage}
              onClearAll={clearAllClippedImages}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default App;
