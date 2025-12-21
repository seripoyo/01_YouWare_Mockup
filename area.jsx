import { useState, useRef } from 'react';

const LiquidGlassUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください');
      return;
    }
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('JPG, PNG, WebP形式のみ対応しています');
      return;
    }

    setUploadedFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setUploadedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={styles.container}>
      {/* Animated background blobs */}
      <div style={styles.backgroundBlobs}>
        <div style={{...styles.blob, ...styles.blob1}}></div>
        <div style={{...styles.blob, ...styles.blob2}}></div>
        <div style={{...styles.blob, ...styles.blob3}}></div>
      </div>

      {/* Main glass card */}
      <div
        style={{
          ...styles.glassCard,
          ...(isDragging ? styles.glassCardDragging : {}),
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {/* Inner glass panel */}
        <div style={{
          ...styles.innerGlass,
          ...(isDragging ? styles.innerGlassDragging : {}),
        }}>
          {preview ? (
            <div style={styles.previewContainer}>
              <img src={preview} alt="Preview" style={styles.previewImage} />
              <button style={styles.clearButton} onClick={clearFile}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <div style={styles.fileName}>{uploadedFile?.name}</div>
            </div>
          ) : (
            <>
              {/* Cloud upload icon */}
              <div style={styles.iconContainer}>
                <svg style={styles.cloudIcon} viewBox="0 0 64 48" fill="none">
                  <defs>
                    <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M52 28C52 22.4772 47.5228 18 42 18C41.6558 18 41.3145 18.0137 40.9766 18.0407C38.8924 12.2353 33.4286 8 27 8C18.7157 8 12 14.7157 12 23C12 23.3404 12.0112 23.6782 12.0333 24.0132C6.46891 25.1396 2 30.0471 2 36C2 42.6274 7.37258 48 14 48H50C56.6274 48 62 42.6274 62 36C62 31.0543 58.6329 26.8822 54.0489 25.3644C53.3749 25.1301 52.6862 24.9426 52 24.8048"
                    stroke="url(#cloudGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="rgba(255,255,255,0.15)"
                  />
                </svg>
                <div style={styles.arrowContainer}>
                  <svg style={styles.arrowIcon} viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 19V5M12 5L5 12M12 5L19 12"
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div style={styles.imageIcon}>
                  <svg viewBox="0 0 32 32" fill="none">
                    <rect
                      x="2"
                      y="6"
                      width="28"
                      height="20"
                      rx="3"
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="2"
                      fill="rgba(255,255,255,0.1)"
                    />
                    <circle cx="10" cy="13" r="3" fill="rgba(255,255,255,0.6)" />
                    <path
                      d="M4 22L10 16L14 20L22 12L28 18"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Text content */}
              <h2 style={styles.title}>
                Drag & drop an image here,
                <br />
                or click to select file
              </h2>
              <p style={styles.subtitle}>
                JPG, PNG, WebP (最大 5MB)
              </p>
            </>
          )}
        </div>

        {/* Highlight edges */}
        <div style={styles.highlightTop}></div>
        <div style={styles.highlightLeft}></div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={styles.hiddenInput}
      />

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(0.95); }
          66% { transform: translate(30px, -40px) scale(1.05); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, 40px) scale(1.1); }
          66% { transform: translate(-30px, -20px) scale(0.9); }
        }
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #5b8cbe 0%, #7ba3d0 25%, #a8c4e4 50%, #7ba3d0 75%, #5b8cbe 100%)',
    backgroundSize: '400% 400%',
    animation: 'gradientShift 15s ease infinite',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  },
  backgroundBlobs: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    filter: 'blur(60px)',
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    opacity: 0.6,
  },
  blob1: {
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(173,216,230,0.3) 100%)',
    top: '-100px',
    left: '-100px',
    animation: 'float1 20s ease-in-out infinite',
  },
  blob2: {
    width: '350px',
    height: '350px',
    background: 'radial-gradient(circle, rgba(135,206,250,0.4) 0%, rgba(100,149,237,0.2) 100%)',
    bottom: '-50px',
    right: '-50px',
    animation: 'float2 25s ease-in-out infinite',
  },
  blob3: {
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(176,224,230,0.2) 100%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'float3 18s ease-in-out infinite',
  },
  glassCard: {
    position: 'relative',
    width: '420px',
    height: '380px',
    padding: '16px',
    borderRadius: '32px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.4)',
    boxShadow: `
      0 8px 32px rgba(0,0,0,0.12),
      0 2px 8px rgba(0,0,0,0.08),
      inset 0 1px 0 rgba(255,255,255,0.5),
      inset 0 -1px 0 rgba(255,255,255,0.1)
    `,
    cursor: 'pointer',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
  },
  glassCardDragging: {
    transform: 'scale(1.02)',
    boxShadow: `
      0 16px 48px rgba(0,0,0,0.2),
      0 4px 16px rgba(0,0,0,0.12),
      inset 0 1px 0 rgba(255,255,255,0.6),
      inset 0 -1px 0 rgba(255,255,255,0.2),
      0 0 0 2px rgba(255,255,255,0.5)
    `,
  },
  innerGlass: {
    width: '100%',
    height: '100%',
    borderRadius: '20px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
    border: '1px solid rgba(255,255,255,0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  },
  innerGlassDragging: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)',
    border: '2px dashed rgba(255,255,255,0.6)',
  },
  highlightTop: {
    position: 'absolute',
    top: '8px',
    left: '24px',
    right: '24px',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
    borderRadius: '50%',
  },
  highlightLeft: {
    position: 'absolute',
    top: '24px',
    bottom: '24px',
    left: '8px',
    width: '1px',
    background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent)',
    borderRadius: '50%',
  },
  iconContainer: {
    position: 'relative',
    width: '100px',
    height: '80px',
    marginBottom: '24px',
  },
  cloudIcon: {
    width: '80px',
    height: '60px',
    position: 'absolute',
    top: '0',
    left: '10px',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
  },
  arrowContainer: {
    position: 'absolute',
    top: '12px',
    left: '32px',
    animation: 'arrowBounce 2s ease-in-out infinite',
  },
  arrowIcon: {
    width: '28px',
    height: '28px',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
  },
  imageIcon: {
    position: 'absolute',
    bottom: '-5px',
    right: '5px',
    width: '40px',
    height: '40px',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    margin: '0 0 12px 0',
    lineHeight: '1.5',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
    letterSpacing: '-0.2px',
  },
  subtitle: {
    fontSize: '14px',
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    margin: '0',
    letterSpacing: '0.5px',
  },
  hiddenInput: {
    display: 'none',
  },
  previewContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '80%',
    objectFit: 'contain',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  },
  clearButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  fileName: {
    marginTop: '12px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: '0 16px',
  },
};

export default LiquidGlassUpload;