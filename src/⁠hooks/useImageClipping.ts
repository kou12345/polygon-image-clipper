import { useState } from "react";
import { Point, ClippedImageInfo } from "../types";

type UseImageClippingProps = {
  images: string[];
  currentImageIndex: number;
};

/**
 * 選択されたポイントからバウンディングボックス（最小矩形）を計算する関数
 * @param selectedPoints 選択されたポイントの配列
 * @returns バウンディングボックスの情報（minX, minY, maxX, maxY, width, height）
 */
const calculateBoundingBox = (selectedPoints: Point[]) => {
  const xValues = selectedPoints.map((p) => p.x);
  const yValues = selectedPoints.map((p) => p.y);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);
  const width = maxX - minX;
  const height = maxY - minY;
  return { minX, minY, maxX, maxY, width, height };
};

/**
 * 指定した領域で画像をクリップし、Data URL を生成する関数
 * @param img クリップ対象の画像オブジェクト
 * @param selectedPoints クリップエリアを定義するポイントの配列
 * @param minX クリップエリアの最小X座標
 * @param minY クリップエリアの最小Y座標
 * @param width クリップエリアの幅
 * @param height クリップエリアの高さ
 * @returns クリップされた画像の Data URL
 */
const createClippedImageDataURL = (
  img: HTMLImageElement,
  selectedPoints: Point[],
  minX: number,
  minY: number,
  width: number,
  height: number
): string => {
  const clipCanvas = document.createElement("canvas");
  clipCanvas.width = width;
  clipCanvas.height = height;
  const clipCtx = clipCanvas.getContext("2d");
  if (!clipCtx) {
    throw new Error("2Dコンテキストの取得に失敗しました");
  }

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
  return clipCanvas.toDataURL("image/jpeg");
};

/**
 * 選択されたポイントを使用して画像をクリップする関数
 * @param imageUrl クリップ対象の画像のURL
 * @param selectedPoints クリップエリアを定義するポイントの配列
 * @param currentImageIndex 現在の画像のインデックス
 * @returns クリップされた画像情報（ClippedImageInfo）を含むPromise
 */
const clipImageFromPoints = (
  imageUrl: string,
  selectedPoints: Point[],
  currentImageIndex: number
): Promise<Omit<ClippedImageInfo, "zIndex">> => {
  return new Promise((resolve, reject) => {
    if (selectedPoints.length < 3) {
      return reject(new Error("クリップには少なくとも3つのポイントが必要です"));
    }

    const img = new Image();
    img.src = imageUrl;

    img.onload = () => {
      const { minX, minY, maxX, maxY, width, height } =
        calculateBoundingBox(selectedPoints);
      const clippedImageUrl = createClippedImageDataURL(
        img,
        selectedPoints,
        minX,
        minY,
        width,
        height
      );

      const newClippedImage: Omit<ClippedImageInfo, "zIndex"> = {
        imageUrl: clippedImageUrl,
        coordinates: {
          minX,
          minY,
          maxX,
          maxY,
          pageIndex: currentImageIndex,
        },
        points: [...selectedPoints],
      };

      resolve(newClippedImage);
    };

    img.onerror = () => {
      reject(new Error("画像の読み込みに失敗しました"));
    };
  });
};

/**
 * 画像のクリッピングを管理するカスタムフック
 * @param images 画像の配列
 * @param currentImageIndex 現在表示中の画像のインデックス
 * @returns クリップされた画像情報、クリップ関数などを含むオブジェクト
 */
export const useImageClipping = ({
  images,
  currentImageIndex,
}: UseImageClippingProps) => {
  const [clippedImages, setClippedImages] = useState<ClippedImageInfo[]>([]);

  /**
   * 選択されたポイントに基づいて現在の画像をクリップする関数
   * @param selectedPoints クリップエリアを定義するポイントの配列
   * @returns クリップされた画像情報（ClippedImageInfo）を含むPromise
   */
  const clipImage = async (
    selectedPoints: Point[]
  ): Promise<ClippedImageInfo> => {
    try {
      const imageUrl = images[currentImageIndex];
      const newClippedImage = await clipImageFromPoints(
        imageUrl,
        selectedPoints,
        currentImageIndex
      );
      const clippedImageWithZIndex: ClippedImageInfo = {
        ...newClippedImage,
        zIndex: clippedImages.length,
      };
      setClippedImages((prev) => [clippedImageWithZIndex, ...prev]);
      return clippedImageWithZIndex;
    } catch (error) {
      throw error;
    }
  };

  return {
    clippedImages,
    setClippedImages,
    clipImage,
  };
};
