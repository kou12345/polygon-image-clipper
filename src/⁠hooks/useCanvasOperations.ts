import { Point } from "../types";

export const useCanvasOperations = () => {
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
