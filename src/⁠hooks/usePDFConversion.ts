import { useState } from "react";
import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const usePDFConversion = () => {
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * PDFファイルをBase64エンコードされた画像の配列に変換する関数
   * @param file PDFファイル
   */
  const convertPDFToImages = async (file: File) => {
    setIsLoading(true);
    try {
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
        if (!renderContext) {
          throw new Error("2Dコンテキストの取得に失敗しました");
        }

        const renderTask = page.render({
          canvasContext: renderContext,
          viewport,
        });
        await renderTask.promise;

        const base64Image = canvas.toDataURL("image/jpeg");
        base64ImageList.push(base64Image);
      }

      setImages(base64ImageList);
    } catch (error) {
      console.error("PDFの変換に失敗しました:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    images,
    isLoading,
    convertPDFToImages,
  };
};
