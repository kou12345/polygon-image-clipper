export type Point = {
  x: number;
  y: number;
};

export type ClippedImageInfo = {
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
};
