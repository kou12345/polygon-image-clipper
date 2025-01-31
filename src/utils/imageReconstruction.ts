import { ClippedImageInfo } from "../types";

/**
 * クリップされた画像情報を使用して、指定したページの画像を再構築する関数
 * @param pageIndex ページのインデックス
 * @param originalImageWidth 元の画像の幅
 * @param originalImageHeight 元の画像の高さ
 * @param clippedImages クリップされた画像情報の配列
 * @returns 再構築された画像のData URLまたはnull
 */
export const reconstructFromClippedImages = async (
  pageIndex: number,
  originalImageWidth: number,
  originalImageHeight: number,
  clippedImages: ClippedImageInfo[]
): Promise<string | null> => {
  const pageClips = clippedImages.filter(
    (clip) => clip.coordinates.pageIndex === pageIndex
  );

  if (pageClips.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = originalImageWidth;
  canvas.height = originalImageHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2Dコンテキストの取得に失敗しました");
  }

  // 背景を白で塗りつぶす
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 切り取った画像を順番に配置
  await Promise.all(
    pageClips.map(
      (clip) =>
        new Promise<void>((resolveClip, rejectClip) => {
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
          clipImg.onerror = () => {
            rejectClip(new Error("クリップ画像の読み込みに失敗しました"));
          };
          clipImg.src = clip.imageUrl;
        })
    )
  );

  return canvas.toDataURL("image/jpeg");
};
