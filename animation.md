【技術スタック】
アニメーションライブラリ: gsap および gsap/Flip プラグイン
CSSレイアウト: CSS Multi-column layout (columns-X プロパティ)
フレームワーク: React (useLayoutEffect を使用)
【実装の重要ポイント】
DOMの永続性:
フィルタリング時に要素をReactの map から削除（アンマウント）するのではなく、全ての要素をDOM上に保持し続けること。
visibleItems（表示対象）に含まれない要素に対しては、GSAP Flipの処理の直前で display: none を適用する。
GSAP Flipのフロー:
アニメーションのトリガーは visibleItems の変更時。
Flip.getState() で変更前の全要素の位置・サイズを記録。
DOM（display属性）を更新。
Flip.from(state, { ... }) で、記録した状態から現在の状態へアニメーションさせる。
アニメーションの詳細設定:
duration: 0.5秒程度。
ease: power2.inOut など。
stagger: 要素が順番に動くように 0.2 程度の遅延を設定。
absolute: true: 要素が移動中にレイアウトを崩さないよう、アニメーション中は絶対配置として扱う設定。
onEnter: 新しく現れる要素の opacity と scale のフェードイン。
onLeave: 消える要素の opacity と scale のフェードアウト。
Masonryレイアウトの維持:
コンテナに columns-1 sm:columns-2 lg:columns-3 等を指定。
各アイテムに break-inside-avoid を指定して、列の途中で要素が泣き別れないようにする。
なぜこの指示が必要なのか（補足）
通常、Reactでフィルタリングを行うと「要素がパッと消えて、残りがパッと詰まる」という無機質な動きになります。