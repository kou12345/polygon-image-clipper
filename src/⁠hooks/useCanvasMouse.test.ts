import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { useCanvasMouse } from "./useCanvasMouse";
import { Point } from "../types";

// フェイクの canvas を作成
const fakeCanvas = {} as HTMLCanvasElement;
const canvasRef = createRef<HTMLCanvasElement>();
Object.defineProperty(canvasRef, "current", {
  value: fakeCanvas,
  writable: true,
});

// シンプルな getCanvasCoordinates: clientX と clientY を Point として返す
const getCanvasCoordinates = (
  event: React.MouseEvent<HTMLCanvasElement>,
  _canvas: HTMLCanvasElement
): Point => ({ x: event.clientX, y: event.clientY });

// フェイクのマウスイベントを生成するヘルパー関数
const createMouseEvent = (
  clientX: number,
  clientY: number
): React.MouseEvent<HTMLCanvasElement> => {
  return {
    clientX,
    clientY,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as React.MouseEvent<HTMLCanvasElement>;
};

describe("useCanvasMouse フック", () => {
  test("既存のポイント付近でなければクリックで新しいポイントを追加する", () => {
    const { result } = renderHook(() =>
      useCanvasMouse({ canvasRef, getCanvasCoordinates })
    );

    // 初期状態はポイントがないことを確認
    expect(result.current.selectedPoints).toHaveLength(0);

    const mouseEvent = createMouseEvent(50, 50);
    act(() => {
      result.current.handleMouseDown(mouseEvent);
    });

    // クリック後、ポイントが1つ追加されるはず
    expect(result.current.selectedPoints).toHaveLength(1);
    expect(result.current.selectedPoints[0]).toEqual({ x: 50, y: 50 });
  });

  test("既存のポイントの近くでクリックするとドラッグ開始のため dragPointIndex が設定される", () => {
    const { result } = renderHook(() =>
      useCanvasMouse({ canvasRef, getCanvasCoordinates })
    );

    // まず初期のポイントを追加
    act(() => {
      result.current.handleMouseDown(createMouseEvent(100, 100));
    });
    expect(result.current.selectedPoints).toHaveLength(1);

    // 既存のポイント近く(閾値20以下)をクリックする
    act(() => {
      result.current.handleMouseDown(createMouseEvent(105, 105));
    });

    // 距離が約7.07（5,5差分）なので、ドラッグが開始されるはず
    expect(result.current.selectedPoints).toHaveLength(1);
    expect(result.current.selectedPoints[0]).toEqual({ x: 100, y: 100 });

    // ドラッグのシミュレーション: マウスムーブでポイントの更新を確認
    act(() => {
      result.current.handleMouseMove(createMouseEvent(110, 110));
    });
    expect(result.current.selectedPoints[0]).toEqual({ x: 110, y: 110 });
  });

  test("ドラッグ中のマウス移動でポイントの位置が更新される", () => {
    const { result } = renderHook(() =>
      useCanvasMouse({ canvasRef, getCanvasCoordinates })
    );

    // ポイントを追加
    act(() => {
      result.current.handleMouseDown(createMouseEvent(200, 200));
    });
    // ポイント近くをクリックしてドラッグを開始
    act(() => {
      result.current.handleMouseDown(createMouseEvent(205, 205));
    });
    // マウス移動シミュレーション
    act(() => {
      result.current.handleMouseMove(createMouseEvent(250, 250));
    });
    expect(result.current.selectedPoints[0]).toEqual({ x: 250, y: 250 });
  });

  test("マウスアップとマウスリーブでドラッグ状態がリセットされる", () => {
    const { result } = renderHook(() =>
      useCanvasMouse({ canvasRef, getCanvasCoordinates })
    );

    // ポイントを追加してドラッグを開始する
    act(() => {
      result.current.handleMouseDown(createMouseEvent(300, 300));
      // 近くの点をクリックしてドラッグ開始
      result.current.handleMouseDown(createMouseEvent(305, 305));
    });
    // ドラッグ中のマウス移動
    act(() => {
      result.current.handleMouseMove(createMouseEvent(310, 310));
    });
    // ドラッグ終了
    act(() => {
      result.current.handleMouseUp();
    });
    // ドラッグ状態がリセットされているか、さらなるマウス移動で影響がないか確認
    act(() => {
      result.current.handleMouseMove(createMouseEvent(320, 320));
    });
    // マウスリーブでもドラッグ状態をリセット
    act(() => {
      result.current.handleMouseLeave();
    });
    // ポイントの位置はマウスアップ時のもののままであることを確認
    expect(result.current.selectedPoints[0]).toEqual({ x: 310, y: 310 });
  });
});
