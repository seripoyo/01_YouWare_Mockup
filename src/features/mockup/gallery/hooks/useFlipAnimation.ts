
import { useRef, useLayoutEffect, useCallback } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

interface UseFlipAnimationOptions {
  duration?: number;
  staggerAmount?: number;
  ease?: string;
}

interface FlipAnimationResult {
  captureState: () => void;
}

/**
 * GSAP Flipアニメーションを使用したフィルタリングアニメーションフック
 *
 * 最適化ポイント:
 * 1. 表示中の要素のみを対象にFlip状態をキャプチャ
 * 2. 依存配列にIDリストの文字列化を使用し、不要な再実行を防止
 * 3. 初回レンダリング時はアニメーションをスキップ
 */
export function useFlipAnimation<T extends { id: string }>(
  containerRef: React.RefObject<HTMLElement | null>,
  visibleItems: T[],
  selector: string = ".mockup-item",
  options: UseFlipAnimationOptions = {}
): FlipAnimationResult {
  const {
    duration = 0.5,
    staggerAmount = 0.02,
    ease = "power2.out",
  } = options;

  const lastStateRef = useRef<Flip.FlipState | null>(null);
  const isFirstRenderRef = useRef(true);
  const previousIdsRef = useRef<Set<string>>(new Set());

  // 手動で状態をキャプチャするためのコールバック
  const captureState = useCallback(() => {
    if (!containerRef.current) return;
    const elements = containerRef.current.querySelectorAll(selector);
    if (elements.length > 0) {
      lastStateRef.current = Flip.getState(elements);
    }
  }, [containerRef, selector]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // 現在のIDセットを作成
    const currentIds = new Set(visibleItems.map(item => item.id));

    // 初回レンダリング時はアニメーションをスキップして状態のみキャプチャ
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousIdsRef.current = currentIds;

      // 初回は単純にフェードインアニメーション
      const elements = containerRef.current.querySelectorAll(selector);
      if (elements.length > 0) {
        gsap.fromTo(
          elements,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.015,
            ease: "power2.out",
            clearProps: "transform"
          }
        );
        // 初回アニメーション後に状態をキャプチャ
        setTimeout(() => {
          lastStateRef.current = Flip.getState(elements);
        }, 500);
      }
      return;
    }

    // IDセットが変更されていない場合はスキップ
    const idsChanged =
      currentIds.size !== previousIdsRef.current.size ||
      ![...currentIds].every(id => previousIdsRef.current.has(id));

    if (!idsChanged) {
      return;
    }

    // 新しく追加されたIDと削除されたIDを特定
    const addedIds = [...currentIds].filter(id => !previousIdsRef.current.has(id));
    const removedIds = [...previousIdsRef.current].filter(id => !currentIds.has(id));

    previousIdsRef.current = currentIds;

    const ctx = gsap.context(() => {
      const allElements = containerRef.current!.querySelectorAll(selector);

      if (lastStateRef.current && allElements.length > 0) {
        // Flip アニメーションを実行
        Flip.from(lastStateRef.current, {
          targets: allElements,
          duration,
          scale: false, // scaleアニメーションを無効化してパフォーマンス改善
          ease,
          stagger: {
            amount: staggerAmount,
            from: "start",
          },
          absolute: true,
          onEnter: (elements) => {
            // 新しく追加された要素のアニメーション
            gsap.fromTo(
              elements,
              { opacity: 0, y: 20 },
              {
                opacity: 1,
                y: 0,
                duration: 0.35,
                ease: "power2.out",
                clearProps: "transform"
              }
            );
          },
          onLeave: (elements) => {
            // 削除される要素のアニメーション
            gsap.to(elements, {
              opacity: 0,
              duration: 0.2,
              ease: "power2.in"
            });
          },
          onComplete: () => {
            // アニメーション完了後に状態を更新
            const newElements = containerRef.current?.querySelectorAll(selector);
            if (newElements && newElements.length > 0) {
              lastStateRef.current = Flip.getState(newElements);
            }
          }
        });
      } else if (allElements.length > 0) {
        // 前の状態がない場合は単純にフェードイン
        gsap.fromTo(
          allElements,
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.015,
            ease: "power2.out",
            clearProps: "transform"
          }
        );
        lastStateRef.current = Flip.getState(allElements);
      }
    }, containerRef);

    return () => ctx.revert();
  }, [visibleItems, containerRef, selector, duration, staggerAmount, ease]);

  return { captureState };
}
