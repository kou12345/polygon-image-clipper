import { useState } from "react";
import { Point } from "../types";

type UseCanvasMouseProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  getCanvasCoordinates: (
    event: React.MouseEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => Point;
};

export const useCanvasMouse = ({
  canvasRef,
  getCanvasCoordinates,
}: UseCanvasMouseProps) => {
  const [selectedPoints, setSelectedPoints] = useState<Point[]>([]);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);
  const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({
    border: "1px solid black",
    display: "block",
    maxWidth: "90%",
    margin: "0 auto",
  });

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

  const handleMouseLeave = () => {
    setDragPointIndex(null);
    setCanvasStyle(getCanvasStyle());
  };

  return {
    selectedPoints,
    setSelectedPoints,
    canvasStyle,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};
