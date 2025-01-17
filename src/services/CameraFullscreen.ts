export async function initCameraFullscreen(): Promise<HTMLVideoElement> {
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true; 
    video.muted = true; 
    
    // Detectar dimensiones de la pantalla
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
  
    // Asignar dimensiones del video en píxeles
    video.width = screenWidth;
    video.height = screenHeight;
  
    // Aplicar estilos para ocupar toda la pantalla
    video.style.position = "absolute";
    video.style.top = "0";
    video.style.left = "0";
    video.style.width = `${screenWidth}px`;
    video.style.height = `${screenHeight}px`;
    video.style.objectFit = "cover";
    video.style.display = "none";
    document.body.appendChild(video);
  
    // Verificar soporte de getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "La API de la cámara no está soportada en este navegador. Por favor, actualiza tu navegador."
      );
    }
  
    try {
      const constraints = {
        video: {
          facingMode: "user",
          width: { ideal: screenWidth / 2 }, 
          height: { ideal: screenHeight / 2 },
        },
      };
      
  
      // Capturar el stream de la cámara
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
  
      // Asegurar reproducción automática después de cargar metadatos
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play(); 
          resolve(video);
        };
      });
    } catch (error) {
      // Manejo de errores
      console.error("Error al acceder a la cámara:", error);
      alert(
        "No se pudo acceder a la cámara. Verifica los permisos o el soporte del navegador."
      );
      throw new Error(
        "No se pudo acceder a la cámara. Por favor, revisa los permisos."
      );
    }
  }
  