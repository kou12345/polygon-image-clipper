import * as pdfjs from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// 型定義
type Point = {
  x: number;
  y: number;
};

interface ClippedImageInfo {
  imageUrl: string;
  coordinates: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pageIndex: number;
  };
  points: Point[];
  zIndex: number;
}

// ユーティリティ関数
const getImageDimensions = (
  imageUrl: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
    };
    img.src = imageUrl;
  });
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
    const viewport = page.getViewport({ scale: 5 });
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

// 画像再構築ユーティリティ
const reconstructFromClippedImages = async (
  pageIndex: number,
  originalImageWidth: number,
  originalImageHeight: number,
  clippedImages: ClippedImageInfo[]
): Promise<string | null> => {
  const pageClips = clippedImages.filter(
    (clip) => clip.coordinates.pageIndex === pageIndex
  );

  if (pageClips.length === 0) return null;

  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = originalImageWidth;
    canvas.height = originalImageHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 背景を白で塗りつぶす
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 切り取った画像を順番に配置
    const loadClippedImages = pageClips.map((clip) => {
      return new Promise<void>((resolveClip) => {
        const clipImg = new Image();
        clipImg.onload = () => {
          ctx.save();
          ctx.beginPath();
          clip.points.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.closePath();
          ctx.clip();

          const { minX, minY, maxX, maxY } = clip.coordinates;
          ctx.drawImage(
            clipImg,
            0,
            0,
            clipImg.width,
            clipImg.height,
            minX,
            minY,
            maxX - minX,
            maxY - minY
          );
          ctx.restore();
          resolveClip();
        };
        clipImg.src = clip.imageUrl;
      });
    });

    Promise.all(loadClippedImages).then(() => {
      resolve(canvas.toDataURL("image/jpeg"));
    });
  });
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
    <p className="text-sm text-gray-600">PDF 表示中...</p>
  </div>
);

// ページ選択コンポーネント
const PageSelector = ({
  pageCount,
  currentPage,
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
        variant={currentPage === index ? "default" : "outline"}
      >
        Page {index + 1}
      </Button>
    ))}
  </div>
);

// モーダルコンポーネント
const ImageModal = ({
  imageUrl,
  isOpen,
  onClose,
}: {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "90%",
          maxHeight: "90%",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Modal view"
          style={{
            maxWidth: "100%",
            maxHeight: "90vh",
            objectFit: "contain",
          }}
        />
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "white",
            border: "none",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
          }}
        >
          x
        </button>
      </div>
    </div>
  );
};

// 再構築プレビューコンポーネント
const ReconstructedPreview = ({
  pageIndex,
  originalImage,
  clippedImages,
}: {
  pageIndex: number;
  originalImage: string;
  clippedImages: ClippedImageInfo[];
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      const dimensions = await getImageDimensions(originalImage);
      const reconstructed = await reconstructFromClippedImages(
        pageIndex,
        dimensions.width,
        dimensions.height,
        clippedImages
      );
      setPreviewUrl(reconstructed);
    };

    loadPreview();
  }, [pageIndex, originalImage, clippedImages]);

  const handleDownload = () => {
    if (!previewUrl) return;

    const link = document.createElement("a");
    link.download = `reconstructed-page-${pageIndex + 1}.jpg`;
    link.href = previewUrl;
    link.click();
  };

  if (!previewUrl) return null;

  return (
    <div style={{ marginTop: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <h3>Reconstructed Preview:</h3>
        <Button onClick={handleDownload} variant="secondary" size="sm">
          Download This Page
        </Button>
      </div>
      <img
        src={previewUrl}
        alt="Reconstructed preview"
        style={{
          maxWidth: "100%",
          height: "auto",
          border: "1px solid #ddd",
          borderRadius: "4px",
        }}
      />
    </div>
  );
};

// クリップされた画像カードコンポーネント
const ClippedImageCard = ({
  imageInfo,
  index,
  total,
  onDownload,
  onDelete,
}: {
  imageInfo: ClippedImageInfo;
  index: number;
  total: number;
  onDownload: () => void;
  onDelete: () => void;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState<string>("");

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "4px",
        padding: "8px",
        backgroundColor: "white",
      }}
    >
      <img
        src={imageInfo.imageUrl}
        alt={`Clipped image ${index + 1}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "2px",
          cursor: "pointer",
        }}
        onClick={() => setIsModalOpen(true)}
      />
      <div
        style={{
          marginTop: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="text-sm text-gray-600">
            Clip {total - index} (Page {imageInfo.coordinates.pageIndex + 1})
          </span>
          <div style={{ display: "flex", gap: "4px" }}>
            <Button onClick={onDownload} size="sm">
              Download
            </Button>
            <Button onClick={onDelete} variant="destructive" size="sm">
              Delete
            </Button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px",
              width: "100%",
            }}
            aria-label="Date"
          />
        </div>
      </div>

      <ImageModal
        imageUrl={imageInfo.imageUrl}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

// クリップされた画像ギャラリーコンポーネント
const ClippedImagesGallery = ({
  images,
  onDelete,
  onClearAll,
  onDownload,
  onReconstruct,
}: {
  images: ClippedImageInfo[];
  onDelete: (index: number) => void;
  onClearAll: () => void;
  onDownload: (index: number) => void;
  onReconstruct: () => void;
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
      <div style={{ display: "flex", gap: "8px" }}>
        <Button onClick={onReconstruct} variant="secondary" size="sm">
          Reconstruct Images
        </Button>
        <Button onClick={onClearAll} variant="destructive" size="sm">
          Clear All
        </Button>
      </div>
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
      {images.map((imageInfo, index) => (
        <ClippedImageCard
          key={index}
          imageInfo={imageInfo}
          index={index}
          total={images.length}
          onDelete={() => onDelete(index)}
          onDownload={() => onDownload(index)}
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
  const [clippedImages, setClippedImages] = useState<ClippedImageInfo[]>([]);
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

  // クリップした画像の確定
  const handleClip = () => {
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

      const newClippedImage: ClippedImageInfo = {
        imageUrl: clippedImageUrl,
        coordinates: {
          minX,
          minY,
          maxX,
          maxY,
          pageIndex: currentImageIndex,
        },
        points: [...selectedPoints],
        zIndex: clippedImages.length,
      };

      setClippedImages((prev) => [newClippedImage, ...prev]);
      setSelectedPoints([]);
    };
  };

  // 画像の再構築
  const handleReconstruct = async () => {
    const reconstructedPages = await Promise.all(
      images.map(async (originalImage, index) => {
        const dimensions = await getImageDimensions(originalImage);
        return reconstructFromClippedImages(
          index,
          dimensions.width,
          dimensions.height,
          clippedImages
        );
      })
    );

    const validPages = reconstructedPages.filter(
      (page): page is string => page !== null
    );

    if (validPages.length > 0) {
      validPages.forEach((page, index) => {
        const link = document.createElement("a");
        link.download = `reconstructed-page-${index + 1}.jpg`;
        link.href = page;
        link.click();
      });
    }
  };

  // 画像管理関連の関数
  const handleDownload = (index: number) => {
    const link = document.createElement("a");
    link.download = `clipped-image-${index + 1}.jpg`;
    link.href = clippedImages[index].imageUrl;
    link.click();
  };

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
              onClick={handleClip}
              disabled={selectedPoints.length < 3}
              style={{ marginRight: "10px" }}
            >
              Clip Image
            </Button>
          </div>

          {clippedImages.length > 0 && (
            <>
              <ClippedImagesGallery
                images={clippedImages}
                onDelete={removeClippedImage}
                onClearAll={clearAllClippedImages}
                onDownload={handleDownload}
                onReconstruct={handleReconstruct}
              />

              <ReconstructedPreview
                pageIndex={currentImageIndex}
                originalImage={images[currentImageIndex]}
                clippedImages={clippedImages}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
