import * as pdfjs from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { useImageClipping } from "./⁠hooks/useImageClipping.ts";
import { useCanvasMouse } from "./⁠hooks/useCanvasMouse.ts";
import { useCanvasOperations } from "./⁠hooks/useCanvasOperations.ts";
import { usePDFConversion } from "./⁠hooks/usePDFConversion.ts";
import { useWindowSize } from "./⁠hooks/useWindowSize.ts";
import { reconstructFromClippedImages } from "./utils/imageReconstruction.ts";
import { LoadingSpinner } from "./components/LoadingSpinner.tsx";
import { ClippedImageInfo } from "./types.ts";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

const App = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windowWidth = useWindowSize();
  const { images, isLoading, convertPDFToImages } = usePDFConversion();

  const { clippedImages, setClippedImages, clipImage } = useImageClipping({
    images,
    currentImageIndex,
  });

  const { getCanvasCoordinates, drawCanvas } = useCanvasOperations();

  const {
    selectedPoints,
    setSelectedPoints,
    canvasStyle,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useCanvasMouse({
    canvasRef,
    getCanvasCoordinates,
  });

  // キャンバス描画の更新
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images[currentImageIndex]) return;

    drawCanvas(canvas, images[currentImageIndex], selectedPoints, windowWidth);
  }, [images, currentImageIndex, selectedPoints, windowWidth, drawCanvas]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await convertPDFToImages(file);
  };

  const handleClip = async () => {
    const canvas = canvasRef.current;
    if (!canvas || selectedPoints.length < 3) return;

    try {
      await clipImage(selectedPoints);
      setSelectedPoints([]);
    } catch (error) {
      console.error("画像のクリップに失敗しました:", error);
    }
  };

  // 画像の再構築
  const handleReconstruct = async () => {
    try {
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
    } catch (error) {
      console.error("画像の再構築に失敗しました:", error);
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
              onMouseLeave={handleMouseLeave}
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
