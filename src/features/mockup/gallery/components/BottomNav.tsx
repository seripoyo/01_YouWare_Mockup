import React from "react";

interface BottomNavProps {
  activeTab: "home" | "bookmark" | "search" | "usage" | "setting";
  onTabChange: (tab: "home" | "bookmark" | "search" | "usage" | "setting") => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[30] tablet:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* phone-frame equivalent */}
      <div className="w-full max-w-[390px] mx-auto relative">
        {/* tab-bar */}
        <nav
          className="relative h-16 bg-white flex items-center justify-between px-5 mx-3 mb-2"
          style={{
            borderRadius: "32px",
            boxShadow: "0 -2px 20px rgba(0, 0, 0, 0.08), 0 4px 20px rgba(0, 0, 0, 0.12)",
          }}
        >
          {/* 中央ボタン用の切り欠き効果 - tab-bar::before */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-white"
            style={{
              top: "-12px",
              width: "66px",
              height: "33px",
              borderRadius: "33px 33px 0 0",
              boxShadow: "0 -4px 10px rgba(0, 0, 0, 0.05)",
            }}
          />

          {/* Home */}
          <button
            onClick={() => onTabChange("home")}
            className="flex flex-col items-center justify-center cursor-pointer py-1.5 relative z-[1] min-w-[56px] transition-all duration-300"
            style={{
              transform: activeTab === "home" ? "translateY(-2px)" : "none",
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center transition-all duration-300">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <g fill={activeTab === "home" ? "#2c30ff" : "#747474"} className="transition-all duration-400">
                  <path d="m3.89 28.92a2 2 0 0 1 -1.08-3.69l28.11-18a2 2 0 1 1 2.16 3.36l-28.08 18.01a2 2 0 0 1 -1.11.32z"/>
                  <path d="m60.11 28.92a2 2 0 0 1 -1.11-.32l-28.12-18a2 2 0 0 1 2.16-3.36l28.11 18a2 2 0 0 1 -1.08 3.69z"/>
                  <path d="m42.2 57.09h-23.64a9 9 0 0 1 -9-9v-16.7a2 2 0 0 1 4 0v16.7a5 5 0 0 0 5 5h23.64a2 2 0 0 1 0 4z"/>
                  <path d="m50.41 55a2 2 0 0 1 -1.41-.56 2 2 0 0 1 0-2.83 5 5 0 0 0 1.45-3.52v-16.7a2 2 0 0 1 4 0v16.7a9 9 0 0 1 -2.61 6.34 2 2 0 0 1 -1.43.57z"/>
                </g>
              </svg>
            </div>
            <span
              className="text-[10px] mt-0.5 font-medium tracking-wide transition-all duration-400"
              style={{
                letterSpacing: "0.3px",
                color: activeTab === "home" ? "#2c30ff" : "#747474",
              }}
            >
              Home
            </span>
          </button>

          {/* Bookmark - margin-right for center space */}
          <button
            onClick={() => onTabChange("bookmark")}
            className="flex flex-col items-center justify-center cursor-pointer py-1.5 relative z-[1] min-w-[56px] transition-all duration-300"
            style={{
              marginRight: "28px",
              transform: activeTab === "bookmark" ? "translateY(-2px)" : "none",
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center transition-all duration-300">
              <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <g>
                  <path
                    d="m13.2642 3.2771h-6.5284a2.503 2.503 0 0 0 -2.5 2.5v9.7429a1.2 1.2 0 0 0 2.0264.87l3.7378-3.55 3.7378 3.55a1.1876 1.1876 0 0 0 .82.3325 1.2188 1.2188 0 0 0 .4795-.1 1.1843 1.1843 0 0 0 .7266-1.1025v-9.7429a2.503 2.503 0 0 0 -2.4997-2.5zm1.5 12.2432a.2.2 0 0 1 -.3379.145l-4.0821-3.8775a.499.499 0 0 0 -.6884 0l-4.0821 3.877a.2.2 0 0 1 -.3379-.1445v-9.7432a1.5017 1.5017 0 0 1 1.5-1.5h6.5284a1.5017 1.5017 0 0 1 1.5 1.5z"
                    fill={activeTab === "bookmark" ? "#2c30ff" : "#747474"}
                    className="transition-all duration-400"
                  />
                </g>
              </svg>
            </div>
            <span
              className="text-[10px] mt-0.5 font-medium tracking-wide transition-all duration-400"
              style={{
                letterSpacing: "0.3px",
                color: activeTab === "bookmark" ? "#2c30ff" : "#747474",
              }}
            >
              Bookmark
            </span>
          </button>

          {/* Center Search Button - せり上がり */}
          <button
            onClick={() => onTabChange("search")}
            className="absolute left-1/2 -translate-x-1/2 z-10 p-0 group"
            style={{ bottom: "20px" }}
          >
            <div
              className="w-[50px] h-[50px] rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden transition-shadow duration-600 group-hover:shadow-[0_6px_20px_rgba(27,39,238,0.5)] group-active:shadow-[0_6px_20px_rgba(27,39,238,0.5)]"
              style={{
                background: "linear-gradient(135deg, #5094EC 0%, #1B27EE 35%, #0003B8 70%)",
                boxShadow: "0 4px 15px rgba(27, 39, 238, 0.4)",
              }}
            >
              {/* Hover overlay */}
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-600"
                style={{
                  background: "linear-gradient(135deg, #5094EC 0%, #5094EC 60%, #0004E0 100%)",
                }}
              />
              <svg
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 relative z-[1] transition-all duration-600 group-hover:w-8 group-hover:h-8 group-active:w-8 group-active:h-8"
              >
                <path
                  d="m18.53 17.47-3-3a5.77 5.77 0 1 0 -1.07 1.07l3 3a.75.75 0 0 0 1.06 0 .75.75 0 0 0 .01-1.07zm-11.78-6.47a4.25 4.25 0 1 1 4.25 4.25 4.26 4.26 0 0 1 -4.25-4.25z"
                  fill="#ffffff"
                />
              </svg>
            </div>
          </button>

          {/* Usage - margin-left for center space */}
          <button
            onClick={() => onTabChange("usage")}
            className="flex flex-col items-center justify-center cursor-pointer py-1.5 relative z-[1] min-w-[56px] transition-all duration-300"
            style={{
              marginLeft: "28px",
              transform: activeTab === "usage" ? "translateY(-2px)" : "none",
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center transition-all duration-300">
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <g fill={activeTab === "usage" ? "#2c30ff" : "#747474"} className="transition-all duration-400">
                  <path d="m22 24a1 1 0 0 1 -1 1h-10a1 1 0 0 1 0-2h10a1 1 0 0 1 1 1zm-1-5h-10a1 1 0 0 0 0 2h10a1 1 0 0 0 0-2zm-10-2h10a1 1 0 0 0 0-2h-10a1 1 0 0 0 0 2zm0-8h4a1 1 0 0 0 0-2h-4a1 1 0 0 0 0 2zm0 4h5a1 1 0 0 0 0-2h-5a1 1 0 0 0 0 2z"/>
                  <path d="m25.9877 9.9385a1.0167 1.0167 0 0 0 -.2807-.6455l-6-6a.9891.9891 0 0 0 -.2929-.1959 1.2435 1.2435 0 0 0 -.3526-.0848c-.0215-.0014-.0401-.0123-.0615-.0123h-10a3.0033 3.0033 0 0 0 -3 3v20a3.0033 3.0033 0 0 0 3 3h14a3.0033 3.0033 0 0 0 3-3v-16c0-.0214-.0109-.04-.0123-.0615zm-3.4018-.9385h-2.5859v-2.5859zm.4141 18h-14a1.0009 1.0009 0 0 1 -1-1v-20a1.0009 1.0009 0 0 1 1-1h9v5a1 1 0 0 0 1 1h5v15a1.0006 1.0006 0 0 1 -1 1z"/>
                </g>
              </svg>
            </div>
            <span
              className="text-[10px] mt-0.5 font-medium tracking-wide transition-all duration-400"
              style={{
                letterSpacing: "0.3px",
                color: activeTab === "usage" ? "#2c30ff" : "#747474",
              }}
            >
              Usage
            </span>
          </button>

          {/* Setting */}
          <button
            onClick={() => onTabChange("setting")}
            className="flex flex-col items-center justify-center cursor-pointer py-1.5 relative z-[1] min-w-[56px] transition-all duration-300"
            style={{
              transform: activeTab === "setting" ? "translateY(-2px)" : "none",
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center transition-all duration-300">
              <svg viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <g fill={activeTab === "setting" ? "#2c30ff" : "#747474"} className="transition-all duration-400">
                  <path d="m15.5 8h-10a.5.5 0 0 1 0-1h10a.5.5 0 0 1 0 1z"/>
                  <path d="m19.5 8h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 0 1z"/>
                  <path d="m16.5 9a1.5 1.5 0 1 1 1.5-1.5.5.5 0 0 1 -1 0 .5.5 0 1 0 -.5.5.5.5 0 0 1 0 1z"/>
                  <path d="m7.5 13h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 0 1z"/>
                  <path d="m19.5 13h-10a.5.5 0 0 1 0-1h10a.5.5 0 0 1 0 1z"/>
                  <path d="m8.5 14a1.5 1.5 0 0 1 0-3 .5.5 0 0 1 0 1 .5.5 0 1 0 .5.5.5.5 0 0 1 1 0 1.5 1.5 0 0 1 -1.5 1.5z"/>
                  <path d="m11.5 18h-6a.5.5 0 0 1 0-1h6a.5.5 0 0 1 0 1z"/>
                  <path d="m19.5 18h-6a.5.5 0 0 1 0-1h6a.5.5 0 0 1 0 1z"/>
                  <path d="m12.5 19a.5.5 0 0 1 0-1 .5.5 0 1 0 -.5-.5.5.5 0 0 1 -1 0 1.5 1.5 0 1 1 1.5 1.5z"/>
                </g>
              </svg>
            </div>
            <span
              className="text-[10px] mt-0.5 font-medium tracking-wide transition-all duration-400"
              style={{
                letterSpacing: "0.3px",
                color: activeTab === "setting" ? "#2c30ff" : "#747474",
              }}
            >
              Setting
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
}
